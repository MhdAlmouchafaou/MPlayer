package expo.modules.mplayer

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.MimeTypeMap
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Private folder. Files live in the app's internal storage (sandboxed: invisible to the
 * gallery, file managers and other apps) and the access code is only stored as a salted
 * PBKDF2 hash. There is deliberately no way to recover a forgotten code.
 */
object VaultStore {
  private const val PREFS = "mplayer_vault"
  private const val ITERATIONS = 120_000

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun dir(context: Context): File {
    val d = File(context.filesDir, "vault")
    if (!d.exists()) d.mkdirs()
    val nomedia = File(d, ".nomedia")
    if (!nomedia.exists()) try { nomedia.createNewFile() } catch (_: Throwable) {}
    return d
  }

  private fun indexFile(context: Context) = File(dir(context), "index.json")

  // region code
  private fun hash(pin: String, salt: ByteArray): ByteArray {
    val spec = PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, 256)
    return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
  }

  fun status(context: Context): Map<String, Any?> {
    val p = prefs(context)
    val until = p.getLong("lockUntil", 0)
    return mapOf(
      "hasPin" to p.contains("hash"),
      "length" to p.getInt("length", 0),
      "failCount" to p.getInt("fails", 0),
      "lockedForMs" to (until - System.currentTimeMillis()).coerceAtLeast(0).toDouble()
    )
  }

  fun setPin(context: Context, pin: String): Boolean {
    val p = prefs(context)
    if (p.contains("hash")) return false
    if (!pin.matches(Regex("^\\d{4}$|^\\d{6}$"))) return false
    val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
    p.edit()
      .putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
      .putString("hash", Base64.encodeToString(hash(pin, salt), Base64.NO_WRAP))
      .putInt("length", pin.length)
      .putInt("fails", 0)
      .putLong("lockUntil", 0)
      .apply()
    return true
  }

  /** Checks the code. Repeated failures lock the keypad for longer and longer. */
  fun verify(context: Context, pin: String): Map<String, Any?> {
    val p = prefs(context)
    val now = System.currentTimeMillis()
    val until = p.getLong("lockUntil", 0)
    if (until > now) return mapOf("ok" to false, "lockedForMs" to (until - now).toDouble(), "failCount" to p.getInt("fails", 0))
    val salt = Base64.decode(p.getString("salt", "") ?: "", Base64.NO_WRAP)
    val expected = Base64.decode(p.getString("hash", "") ?: "", Base64.NO_WRAP)
    val ok = expected.isNotEmpty() && MessageDigest.isEqual(hash(pin, salt), expected)
    return if (ok) {
      p.edit().putInt("fails", 0).putLong("lockUntil", 0).apply()
      mapOf("ok" to true, "lockedForMs" to 0.0, "failCount" to 0)
    } else {
      val fails = p.getInt("fails", 0) + 1
      val lockMs = when {
        fails >= 15 -> 30 * 60_000L
        fails >= 10 -> 5 * 60_000L
        fails >= 7 -> 60_000L
        fails >= 5 -> 30_000L
        else -> 0L
      }
      p.edit().putInt("fails", fails).putLong("lockUntil", if (lockMs > 0) now + lockMs else 0).apply()
      mapOf("ok" to false, "lockedForMs" to lockMs.toDouble(), "failCount" to fails)
    }
  }
  // endregion

  // region index
  @Synchronized
  private fun readIndex(context: Context): JSONArray = try {
    val f = indexFile(context)
    if (f.exists()) JSONArray(f.readText()) else JSONArray()
  } catch (_: Throwable) {
    JSONArray()
  }

  @Synchronized
  private fun writeIndex(context: Context, arr: JSONArray) {
    val f = indexFile(context)
    val tmp = File(f.parentFile, "index.json.tmp")
    tmp.writeText(arr.toString())
    if (!tmp.renameTo(f)) {
      f.writeText(arr.toString())
      tmp.delete()
    }
  }

  private fun kindOf(mime: String, name: String): String {
    val m = mime.lowercase()
    val n = name.lowercase()
    return when {
      m.startsWith("video/") -> "video"
      m.startsWith("audio/") -> "audio"
      m.startsWith("image/") -> "image"
      m == "application/pdf" || n.endsWith(".pdf") -> "pdf"
      Regex("\\.(mp4|mkv|mov|avi|webm|3gp|flv|wmv|m4v|ts)$").containsMatchIn(n) -> "video"
      Regex("\\.(mp3|m4a|aac|flac|wav|ogg|opus|amr|wma)$").containsMatchIn(n) -> "audio"
      Regex("\\.(jpg|jpeg|png|webp|gif|heic|heif|bmp)$").containsMatchIn(n) -> "image"
      else -> "file"
    }
  }

  private fun toMap(context: Context, o: JSONObject): Map<String, Any?> {
    val file = File(dir(context), o.getString("file"))
    return mapOf(
      "id" to o.getString("id"),
      "name" to o.optString("name"),
      "mime" to o.optString("mime"),
      "kind" to o.optString("kind"),
      "size" to file.length().toDouble(),
      "added" to o.optDouble("added"),
      "uri" to Uri.fromFile(file).toString(),
      "exists" to file.exists()
    )
  }

  fun list(context: Context): List<Map<String, Any?>> {
    val arr = readIndex(context)
    val out = ArrayList<Map<String, Any?>>()
    for (i in 0 until arr.length()) out.add(toMap(context, arr.getJSONObject(i)))
    return out.sortedByDescending { it["added"] as Double }
  }
  // endregion

  // region import
  private fun queryName(context: Context, uri: Uri): Pair<String?, String?> {
    if (uri.scheme == "file") {
      val f = File(uri.path ?: "")
      return f.name to MimeTypeMap.getSingleton().getMimeTypeFromExtension(f.extension.lowercase())
    }
    var name: String? = null
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) name = c.getString(0)
      }
    } catch (_: Throwable) {
    }
    val mime = try { context.contentResolver.getType(uri) } catch (_: Throwable) { null }
      ?: name?.let { MimeTypeMap.getSingleton().getMimeTypeFromExtension(it.substringAfterLast('.', "").lowercase()) }
    return name to mime
  }

  /** Best effort: the real file path behind a content uri (needed to delete the original). */
  @Suppress("DEPRECATION")
  fun resolvePath(context: Context, uri: Uri): String? {
    if (uri.scheme == "file") return uri.path
    try {
      if (DocumentsContract.isDocumentUri(context, uri)) {
        val docId = DocumentsContract.getDocumentId(uri)
        when (uri.authority) {
          "com.android.externalstorage.documents" -> {
            val parts = docId.split(":", limit = 2)
            if (parts[0].equals("primary", true)) return "${Environment.getExternalStorageDirectory()}/${parts.getOrElse(1) { "" }}"
            return "/storage/${parts[0]}/${parts.getOrElse(1) { "" }}"
          }
          "com.android.providers.downloads.documents" -> {
            if (docId.startsWith("raw:")) return docId.removePrefix("raw:")
          }
          "com.android.providers.media.documents" -> {
            val parts = docId.split(":")
            val base = when (parts[0]) {
              "video" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
              "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
              "image" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
              else -> MediaStore.Files.getContentUri("external")
            }
            parts.getOrNull(1)?.toLongOrNull()?.let { id -> return dataColumn(context, ContentUris.withAppendedId(base, id)) }
          }
        }
      }
    } catch (_: Throwable) {
    }
    return dataColumn(context, uri)
  }

  @Suppress("DEPRECATION")
  private fun dataColumn(context: Context, uri: Uri): String? = try {
    context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.DATA), null, null, null)?.use { c ->
      if (c.moveToFirst()) c.getString(0) else null
    }
  } catch (_: Throwable) {
    null
  }

  private fun deleteOriginal(context: Context, uri: Uri, path: String?): Boolean {
    var deleted = false
    if (path != null) {
      val f = File(path)
      if (f.exists() && f.delete()) {
        deleted = true
        MediaScannerConnection.scanFile(context, arrayOf(path), null, null)
      }
    }
    if (!deleted && uri.scheme == "content") {
      deleted = try {
        if (DocumentsContract.isDocumentUri(context, uri)) DocumentsContract.deleteDocument(context.contentResolver, uri)
        else context.contentResolver.delete(uri, null, null) > 0
      } catch (_: Throwable) {
        false
      }
    }
    if (deleted && path != null) {
      // Remove the stale MediaStore row so the gallery forgets the file at once.
      try {
        context.contentResolver.delete(MediaStore.Files.getContentUri("external"), "${MediaStore.MediaColumns.DATA}=?", arrayOf(path))
      } catch (_: Throwable) {
      }
    }
    return deleted
  }

  /** Copies each file into the vault, then removes the original when allowed. */
  fun importFiles(context: Context, uris: List<String>, removeOriginal: Boolean, onProgress: (Int, Int, String) -> Unit): List<Map<String, Any?>> {
    val results = ArrayList<Map<String, Any?>>()
    val index = readIndex(context)
    uris.forEachIndexed { i, s ->
      val uri = Uri.parse(s)
      val (rawName, rawMime) = queryName(context, uri)
      val name = rawName ?: "Fichier ${i + 1}"
      val mime = rawMime ?: "application/octet-stream"
      onProgress(i, uris.size, name)
      val ext = name.substringAfterLast('.', "").take(8).lowercase()
      val id = UUID.randomUUID().toString()
      val fileName = if (ext.isNotEmpty()) "$id.$ext" else id
      val target = File(dir(context), fileName)
      val path = resolvePath(context, uri)
      try {
        val input: InputStream = if (uri.scheme == "file") FileInputStream(File(uri.path ?: "")) else
          context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("Lecture impossible")
        input.use { inp -> FileOutputStream(target).use { out -> inp.copyTo(out, 256 * 1024) } }
        if (target.length() == 0L) throw IllegalStateException("Fichier vide")
        val entry = JSONObject()
          .put("id", id)
          .put("file", fileName)
          .put("name", name)
          .put("mime", mime)
          .put("kind", kindOf(mime, name))
          .put("added", System.currentTimeMillis().toDouble())
          .put("origin", path ?: "")
        index.put(entry)
        writeIndex(context, index)
        val removed = if (removeOriginal) deleteOriginal(context, uri, path) else false
        results.add(mapOf("ok" to true, "name" to name, "removed" to removed, "id" to id))
      } catch (e: Throwable) {
        target.delete()
        results.add(mapOf("ok" to false, "name" to name, "removed" to false, "error" to (e.message ?: "Erreur")))
      }
    }
    onProgress(uris.size, uris.size, "")
    return results
  }
  // endregion

  // region restore / delete
  private fun find(context: Context, id: String): Pair<JSONArray, Int> {
    val arr = readIndex(context)
    for (i in 0 until arr.length()) if (arr.getJSONObject(i).getString("id") == id) return arr to i
    return arr to -1
  }

  /** Moves a file back to public storage (Movies, Music, Pictures or Documents / MPlayer). */
  fun restore(context: Context, id: String): String? {
    val (arr, i) = find(context, id)
    if (i < 0) return null
    val o = arr.getJSONObject(i)
    val src = File(dir(context), o.getString("file"))
    val name = o.optString("name", src.name)
    val mime = o.optString("mime", "application/octet-stream")
    val kind = o.optString("kind")
    val (collection, folder) = when (kind) {
      "video" -> (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Video.Media.EXTERNAL_CONTENT_URI) to Environment.DIRECTORY_MOVIES
      "audio" -> (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Audio.Media.EXTERNAL_CONTENT_URI) to Environment.DIRECTORY_MUSIC
      "image" -> (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Images.Media.EXTERNAL_CONTENT_URI) to Environment.DIRECTORY_PICTURES
      else -> MediaStore.Files.getContentUri("external") to Environment.DIRECTORY_DOCUMENTS
    }
    val restored: String? = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, mime)
          put(MediaStore.MediaColumns.RELATIVE_PATH, "$folder/MPlayer")
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(collection, values) ?: throw IllegalStateException("Insertion impossible")
        resolver.openOutputStream(uri)?.use { out -> FileInputStream(src).use { it.copyTo(out, 256 * 1024) } }
        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        uri.toString()
      } else {
        @Suppress("DEPRECATION")
        val d = File(Environment.getExternalStoragePublicDirectory(folder), "MPlayer").apply { mkdirs() }
        var out = File(d, name)
        var n = 1
        while (out.exists()) out = File(d, "${name.substringBeforeLast('.')} (${n++}).${name.substringAfterLast('.', "")}")
        FileInputStream(src).use { inp -> FileOutputStream(out).use { inp.copyTo(it, 256 * 1024) } }
        MediaScannerConnection.scanFile(context, arrayOf(out.path), arrayOf(mime), null)
        Uri.fromFile(out).toString()
      }
    } catch (_: Throwable) {
      null
    }
    if (restored != null) {
      src.delete()
      arr.remove(i)
      writeIndex(context, arr)
    }
    return restored
  }

  fun delete(context: Context, ids: List<String>): Int {
    val arr = readIndex(context)
    var count = 0
    val keep = JSONArray()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      if (o.getString("id") in ids) {
        File(dir(context), o.getString("file")).delete()
        count++
      } else keep.put(o)
    }
    writeIndex(context, keep)
    return count
  }

  fun rename(context: Context, id: String, name: String): Boolean {
    val (arr, i) = find(context, id)
    if (i < 0 || name.isBlank()) return false
    arr.getJSONObject(i).put("name", name.trim())
    writeIndex(context, arr)
    return true
  }

  fun usedBytes(context: Context): Double = dir(context).listFiles()?.sumOf { it.length() }?.toDouble() ?: 0.0
  // endregion
}
