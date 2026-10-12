package expo.modules.mplayer

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Size
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/** Video and document indexing, thumbnails and frame extraction. */
object MediaLibrary {
  private val videoCollection: Uri
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
      MediaStore.Video.Media.EXTERNAL_CONTENT_URI
    }

  fun videoUri(id: Long): Uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)

  @Suppress("DEPRECATION")
  fun queryVideos(context: Context): List<Map<String, Any?>> {
    val projection = mutableListOf(
      MediaStore.Video.Media._ID,
      MediaStore.Video.Media.TITLE,
      MediaStore.Video.Media.DISPLAY_NAME,
      MediaStore.Video.Media.DURATION,
      MediaStore.Video.Media.WIDTH,
      MediaStore.Video.Media.HEIGHT,
      MediaStore.Video.Media.SIZE,
      MediaStore.Video.Media.DATE_ADDED,
      MediaStore.Video.Media.DATA,
      MediaStore.Video.Media.MIME_TYPE
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) projection.add(MediaStore.Video.Media.ORIENTATION)

    val out = ArrayList<Map<String, Any?>>()
    context.contentResolver.query(
      videoCollection,
      projection.toTypedArray(),
      null,
      null,
      "${MediaStore.Video.Media.DATE_ADDED} DESC"
    )?.use { c ->
      val idCol = c.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
      val titleCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE)
      val nameCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
      val durCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
      val wCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH)
      val hCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT)
      val sizeCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
      val dateCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED)
      val dataCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DATA)
      val mimeCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE)
      val oriCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) c.getColumnIndex(MediaStore.Video.Media.ORIENTATION) else -1
      while (c.moveToNext()) {
        val id = c.getLong(idCol)
        val path = c.getString(dataCol) ?: ""
        val name = c.getString(nameCol) ?: path.substringAfterLast('/')
        val rawTitle = c.getString(titleCol)
        var w = c.getInt(wCol)
        var h = c.getInt(hCol)
        val ori = if (oriCol >= 0) c.getInt(oriCol) else 0
        if (ori == 90 || ori == 270) {
          val tmp = w; w = h; h = tmp
        }
        out.add(
          mapOf(
            "id" to id.toString(),
            "uri" to videoUri(id).toString(),
            "title" to (if (rawTitle.isNullOrBlank()) name.substringBeforeLast('.') else rawTitle),
            "fileName" to name,
            "duration" to c.getLong(durCol).toDouble(),
            "width" to w,
            "height" to h,
            "size" to c.getLong(sizeCol).toDouble(),
            "dateAdded" to c.getLong(dateCol).toDouble(),
            "path" to path,
            "folder" to path.substringBeforeLast('/', ""),
            "mimeType" to (c.getString(mimeCol) ?: "")
          )
        )
      }
    }
    return out
  }

  private fun cacheDir(context: Context, name: String) = File(context.cacheDir, name).apply { mkdirs() }

  private fun hash(s: String): String {
    val d = MessageDigest.getInstance("MD5").digest(s.toByteArray())
    return d.joinToString("") { "%02x".format(it) }.take(20)
  }

  private fun saveJpeg(bitmap: Bitmap, target: File, quality: Int = 82): String? = try {
    FileOutputStream(target).use { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it) }
    Uri.fromFile(target).toString()
  } catch (_: Throwable) {
    null
  }

  /** Cached thumbnail of a MediaStore video (or of any uri, through the retriever). */
  @Suppress("DEPRECATION")
  fun videoThumbnail(context: Context, idOrUri: String, width: Int): String? {
    val dir = cacheDir(context, "mplayer-vthumbs")
    val key = hash("$idOrUri@$width")
    val target = File(dir, "$key.jpg")
    val miss = File(dir, "$key.none")
    if (target.exists() && target.length() > 0) return Uri.fromFile(target).toString()
    if (miss.exists()) return null
    val height = width * 9 / 16
    val id = idOrUri.toLongOrNull()
    var bmp: Bitmap? = null
    if (id != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      bmp = try {
        context.contentResolver.loadThumbnail(videoUri(id), Size(width, height), null)
      } catch (_: Throwable) {
        null
      }
    }
    if (bmp == null && id != null && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      bmp = try {
        MediaStore.Video.Thumbnails.getThumbnail(context.contentResolver, id, MediaStore.Video.Thumbnails.MINI_KIND, null)
      } catch (_: Throwable) {
        null
      }
    }
    if (bmp == null) {
      val uri = if (id != null) videoUri(id) else Uri.parse(idOrUri)
      bmp = frameBitmap(context, uri, 1_000_000L, width)
    }
    if (bmp == null) {
      try { miss.createNewFile() } catch (_: Throwable) {}
      return null
    }
    val scaled = if (bmp.width > width * 1.5) ThumbnailUtils.extractThumbnail(bmp, width, (width.toFloat() * bmp.height / bmp.width).toInt()) else bmp
    val result = saveJpeg(scaled, target)
    if (scaled !== bmp) scaled.recycle()
    bmp.recycle()
    return result
  }

  // One retriever kept open for the video being scrubbed: frame requests stay fast.
  private var retriever: MediaMetadataRetriever? = null
  private var retrieverUri: String? = null

  @Synchronized
  private fun retrieverFor(context: Context, uri: Uri): MediaMetadataRetriever? {
    val key = uri.toString()
    if (retrieverUri == key && retriever != null) return retriever
    try { retriever?.release() } catch (_: Throwable) {}
    retriever = null
    retrieverUri = null
    return try {
      val r = MediaMetadataRetriever()
      if (uri.scheme == "file") r.setDataSource(uri.path) else r.setDataSource(context, uri)
      retriever = r
      retrieverUri = key
      r
    } catch (_: Throwable) {
      null
    }
  }

  @Synchronized
  fun releaseRetriever() {
    try { retriever?.release() } catch (_: Throwable) {}
    retriever = null
    retrieverUri = null
  }

  @Synchronized
  private fun frameBitmap(context: Context, uri: Uri, timeUs: Long, width: Int, exact: Boolean = false): Bitmap? {
    val r = retrieverFor(context, uri) ?: return null
    val option = if (exact) MediaMetadataRetriever.OPTION_CLOSEST else MediaMetadataRetriever.OPTION_CLOSEST_SYNC
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        r.getScaledFrameAtTime(timeUs, option, width, width * 2)
      } else {
        r.getFrameAtTime(timeUs, option)
      }
    } catch (_: Throwable) {
      null
    }
  }

  /** Frame at a given time, for scrub previews (fast, nearest key frame) or exact captures. */
  fun frameAt(context: Context, uriString: String, positionMs: Long, width: Int, exact: Boolean): String? {
    val uri = Uri.parse(uriString)
    val dir = cacheDir(context, "mplayer-frames")
    val bucket = if (exact) positionMs else positionMs / 1000 * 1000
    val target = File(dir, "${hash(uriString)}_${bucket}_${width}${if (exact) "x" else ""}.jpg")
    if (target.exists() && target.length() > 0) return Uri.fromFile(target).toString()
    val bmp = frameBitmap(context, uri, bucket * 1000, width, exact) ?: return null
    val res = saveJpeg(bmp, target, 78)
    bmp.recycle()
    return res
  }

  fun clearFrames(context: Context) {
    File(context.cacheDir, "mplayer-frames").listFiles()?.forEach { it.delete() }
  }

  /** Technical description of a media file. */
  fun probe(context: Context, uriString: String): Map<String, Any?> {
    val r = MediaMetadataRetriever()
    return try {
      val uri = Uri.parse(uriString)
      if (uri.scheme == "file") r.setDataSource(uri.path) else r.setDataSource(context, uri)
      fun m(k: Int) = try { r.extractMetadata(k) } catch (_: Throwable) { null }
      mapOf(
        "mimeType" to m(MediaMetadataRetriever.METADATA_KEY_MIMETYPE),
        "width" to m(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH),
        "height" to m(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT),
        "rotation" to m(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION),
        "bitrate" to m(MediaMetadataRetriever.METADATA_KEY_BITRATE),
        "duration" to m(MediaMetadataRetriever.METADATA_KEY_DURATION),
        "frameRate" to (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) m(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE) else null),
        "date" to m(MediaMetadataRetriever.METADATA_KEY_DATE),
        "location" to m(MediaMetadataRetriever.METADATA_KEY_LOCATION),
        "hasAudio" to m(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO),
        "colorTransfer" to (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) m(MediaMetadataRetriever.METADATA_KEY_COLOR_TRANSFER) else null)
      )
    } catch (_: Throwable) {
      emptyMap()
    } finally {
      try { r.release() } catch (_: Throwable) {}
    }
  }

  fun hasAllFilesAccess(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager() else true

  /**
   * Every PDF on the device. MediaStore indexes non-media files too; with "all files"
   * access (Android 11+) or storage permission (Android 10 and below) it returns them all.
   */
  @Suppress("DEPRECATION")
  fun queryDocuments(context: Context): List<Map<String, Any?>> {
    val out = ArrayList<Map<String, Any?>>()
    val seen = HashSet<String>()
    val collection = MediaStore.Files.getContentUri("external")
    val projection = arrayOf(
      MediaStore.Files.FileColumns._ID,
      MediaStore.Files.FileColumns.DISPLAY_NAME,
      MediaStore.Files.FileColumns.DATA,
      MediaStore.Files.FileColumns.SIZE,
      MediaStore.Files.FileColumns.DATE_MODIFIED
    )
    try {
      context.contentResolver.query(
        collection,
        projection,
        "${MediaStore.Files.FileColumns.MIME_TYPE} = ? OR ${MediaStore.Files.FileColumns.DATA} LIKE ?",
        arrayOf("application/pdf", "%.pdf"),
        "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"
      )?.use { c ->
        val nameCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
        val dataCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATA)
        val sizeCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
        val dateCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
        while (c.moveToNext()) {
          val path = c.getString(dataCol) ?: continue
          val file = File(path)
          if (!seen.add(path) || !file.exists()) continue
          out.add(doc(file, c.getString(nameCol), c.getLong(sizeCol), c.getLong(dateCol)))
        }
      }
    } catch (_: Throwable) {
    }
    // Fallback scan of the usual folders when the index is empty or incomplete.
    if (hasAllFilesAccess()) {
      val root = Environment.getExternalStorageDirectory()
      listOf("Download", "Documents", "WhatsApp", "Android/media/com.whatsapp", "Telegram", "DCIM", "").forEach { sub ->
        val dir = if (sub.isEmpty()) root else File(root, sub)
        walk(dir, if (sub.isEmpty()) 1 else 6) { f ->
          if (seen.add(f.path)) out.add(doc(f, f.name, f.length(), f.lastModified() / 1000))
        }
      }
    }
    return out
  }

  private fun doc(file: File, name: String?, size: Long, modified: Long) = mapOf(
    "id" to file.path,
    "uri" to Uri.fromFile(file).toString(),
    "name" to (name ?: file.name),
    "path" to file.path,
    "folder" to (file.parent ?: ""),
    "size" to size.toDouble(),
    "modified" to modified.toDouble()
  )

  private fun walk(dir: File, depth: Int, onPdf: (File) -> Unit) {
    if (depth < 0 || !dir.isDirectory || dir.name.startsWith(".")) return
    val children = try { dir.listFiles() } catch (_: Throwable) { null } ?: return
    for (f in children) {
      if (f.isDirectory) {
        if (f.name != "Android" || depth > 4) walk(f, depth - 1, onPdf)
      } else if (f.name.endsWith(".pdf", ignoreCase = true)) {
        onPdf(f)
      }
    }
  }

  /** Display name and size of any content:// or file:// uri. */
  fun describeUri(context: Context, uriString: String): Map<String, Any?> {
    val uri = Uri.parse(uriString)
    if (uri.scheme == "file") {
      val f = File(uri.path ?: "")
      return mapOf("name" to f.name, "size" to f.length().toDouble(), "path" to f.path)
    }
    var name: String? = null
    var size = 0L
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          name = c.getString(0)
          size = if (c.isNull(1)) 0 else c.getLong(1)
        }
      }
    } catch (_: Throwable) {
    }
    return mapOf(
      "name" to (name ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Fichier"),
      "size" to size.toDouble(),
      "mimeType" to (try { context.contentResolver.getType(uri) } catch (_: Throwable) { null })
    )
  }
}
