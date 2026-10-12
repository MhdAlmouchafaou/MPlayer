package expo.modules.mplayer

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Size
import androidx.palette.graphics.Palette
import java.io.File
import java.io.FileOutputStream

object MediaScanner {
  private val collection: Uri
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
      MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    }

  fun trackUri(id: Long): Uri = ContentUris.withAppendedId(
    MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
    id
  )

  @Suppress("DEPRECATION")
  fun queryTracks(context: Context, minDurationMs: Long): List<Map<String, Any?>> {
    val projection = mutableListOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.ARTIST_ID,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.DATA,
      MediaStore.Audio.Media.DISPLAY_NAME,
      MediaStore.Audio.Media.DATE_ADDED,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.TRACK,
      MediaStore.Audio.Media.YEAR
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      projection.add(MediaStore.Audio.Media.GENRE)
    }

    val selection = buildString {
      append("${MediaStore.Audio.Media.DURATION} >= ?")
      append(" AND ${MediaStore.Audio.Media.IS_RINGTONE} = 0")
      append(" AND ${MediaStore.Audio.Media.IS_NOTIFICATION} = 0")
      append(" AND ${MediaStore.Audio.Media.IS_ALARM} = 0")
    }

    val result = ArrayList<Map<String, Any?>>()
    context.contentResolver.query(
      collection,
      projection.toTypedArray(),
      selection,
      arrayOf(minDurationMs.toString()),
      "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"
    )?.use { c ->
      val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
      val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
      val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
      val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
      val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
      val artistIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID)
      val durationCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
      val dataCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
      val nameCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
      val dateCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
      val sizeCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
      val mimeCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
      val trackCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
      val yearCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
      val genreCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        c.getColumnIndex(MediaStore.Audio.Media.GENRE)
      } else -1

      while (c.moveToNext()) {
        val id = c.getLong(idCol)
        val data = c.getString(dataCol) ?: ""
        val displayName = c.getString(nameCol) ?: ""
        val rawTitle = c.getString(titleCol)
        val title = if (rawTitle.isNullOrBlank()) displayName.substringBeforeLast('.') else rawTitle
        val folderPath = data.substringBeforeLast('/', "")
        result.add(
          mapOf(
            "id" to id.toString(),
            "uri" to trackUri(id).toString(),
            "title" to title,
            "artist" to cleanTag(c.getString(artistCol)),
            "album" to cleanTag(c.getString(albumCol)),
            "albumId" to c.getLong(albumIdCol).toString(),
            "artistId" to c.getLong(artistIdCol).toString(),
            "duration" to c.getLong(durationCol).toDouble(),
            "path" to data,
            "folder" to folderPath,
            "fileName" to displayName,
            "dateAdded" to c.getLong(dateCol).toDouble(),
            "size" to c.getLong(sizeCol).toDouble(),
            "mimeType" to (c.getString(mimeCol) ?: ""),
            "trackNumber" to c.getInt(trackCol),
            "year" to c.getInt(yearCol),
            "genre" to if (genreCol >= 0) cleanTag(c.getString(genreCol)) else ""
          )
        )
      }
    }
    return result
  }

  private fun cleanTag(value: String?): String {
    if (value.isNullOrBlank()) return ""
    if (value == MediaStore.UNKNOWN_STRING) return ""
    return value.trim()
  }

  /**
   * Returns a file:// URI of a cached JPEG thumbnail for the track, or null when the
   * track has no embedded artwork. Results (including misses) are cached on disk.
   */
  fun artwork(context: Context, trackId: Long, albumId: Long, size: Int): String? {
    val dir = File(context.cacheDir, "mplayer-artwork").apply { mkdirs() }
    val target = File(dir, "t${trackId}_$size.jpg")
    val miss = File(dir, "t${trackId}_$size.none")
    if (target.exists() && target.length() > 0) return Uri.fromFile(target).toString()
    if (miss.exists()) return null

    val bitmap = loadBitmap(context, trackId, albumId, size)
    if (bitmap == null) {
      try {
        miss.createNewFile()
      } catch (_: Throwable) {
      }
      return null
    }
    return try {
      FileOutputStream(target).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out) }
      Uri.fromFile(target).toString()
    } catch (_: Throwable) {
      null
    } finally {
      bitmap.recycle()
    }
  }

  /** Swatch colours (#RRGGBB) extracted from the artwork, or null when there is none. */
  fun palette(context: Context, trackId: Long, albumId: Long): Map<String, Any?>? {
    val uri = artwork(context, trackId, albumId, 512) ?: return null
    val path = Uri.parse(uri).path ?: return null
    val opts = BitmapFactory.Options().apply { inSampleSize = 4 }
    val bmp = BitmapFactory.decodeFile(path, opts) ?: return null
    return try {
      val p = Palette.from(bmp).maximumColorCount(16).generate()
      fun hex(c: Int?): String? = c?.let { String.format("#%06X", 0xFFFFFF and it) }
      mapOf(
        "dominant" to hex(p.dominantSwatch?.rgb),
        "vibrant" to hex(p.vibrantSwatch?.rgb),
        "muted" to hex(p.mutedSwatch?.rgb),
        "darkVibrant" to hex(p.darkVibrantSwatch?.rgb),
        "darkMuted" to hex(p.darkMutedSwatch?.rgb),
        "lightVibrant" to hex(p.lightVibrantSwatch?.rgb),
        "lightMuted" to hex(p.lightMutedSwatch?.rgb)
      )
    } catch (_: Throwable) {
      null
    } finally {
      bmp.recycle()
    }
  }

  fun clearArtworkMisses(context: Context) {
    val dir = File(context.cacheDir, "mplayer-artwork")
    dir.listFiles()?.filter { it.name.endsWith(".none") }?.forEach { it.delete() }
  }

  private fun loadBitmap(context: Context, trackId: Long, albumId: Long, size: Int): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        return context.contentResolver.loadThumbnail(trackUri(trackId), Size(size, size), null)
      } catch (_: Throwable) {
      }
    }
    // Embedded picture through the retriever (works on every API level).
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, trackUri(trackId))
      val bytes = retriever.embeddedPicture
      if (bytes != null) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= size && bounds.outHeight / (sample * 2) >= size) sample *= 2
        val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        if (decoded != null) return decoded
      }
    } catch (_: Throwable) {
    } finally {
      try {
        retriever.release()
      } catch (_: Throwable) {
      }
    }
    if (albumId > 0 && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      try {
        val albumArt = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId)
        context.contentResolver.openInputStream(albumArt)?.use { stream ->
          return BitmapFactory.decodeStream(stream)
        }
      } catch (_: Throwable) {
      }
    }
    return null
  }
}
