package expo.modules.mplayer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/**
 * PDF rendering with the platform PdfRenderer. Pages are rendered to cached PNG files at
 * the requested width so the JS side can display, zoom and recycle them like images.
 * PdfRenderer is not thread-safe: every call is synchronized on the document.
 */
object PdfEngine {
  private class Doc(val key: String, val pfd: ParcelFileDescriptor, val renderer: PdfRenderer)

  private val docs = HashMap<String, Doc>()

  private fun hash(s: String): String {
    val d = MessageDigest.getInstance("MD5").digest(s.toByteArray())
    return d.joinToString("") { "%02x".format(it) }.take(20)
  }

  private fun openPfd(context: Context, uriString: String): ParcelFileDescriptor {
    val uri = Uri.parse(uriString)
    return if (uri.scheme == "file" || uri.scheme == null) {
      ParcelFileDescriptor.open(File(uri.path ?: uriString), ParcelFileDescriptor.MODE_READ_ONLY)
    } else {
      context.contentResolver.openFileDescriptor(uri, "r") ?: throw IllegalStateException("Fichier introuvable")
    }
  }

  @Synchronized
  fun open(context: Context, uriString: String): Map<String, Any?> {
    val existing = docs[uriString]
    val doc = existing ?: run {
      val pfd = openPfd(context, uriString)
      val renderer = try {
        PdfRenderer(pfd)
      } catch (e: SecurityException) {
        pfd.close()
        throw IllegalStateException("Ce PDF est protégé par un mot de passe.")
      } catch (e: Throwable) {
        pfd.close()
        throw IllegalStateException("Ce fichier n'est pas un PDF valide.")
      }
      Doc(hash(uriString), pfd, renderer).also { docs[uriString] = it }
    }
    val sizes = ArrayList<Map<String, Any?>>()
    synchronized(doc) {
      for (i in 0 until doc.renderer.pageCount) {
        val page = doc.renderer.openPage(i)
        try {
          sizes.add(mapOf("w" to page.width, "h" to page.height))
        } finally {
          page.close()
        }
      }
    }
    return mapOf("pageCount" to doc.renderer.pageCount, "pages" to sizes, "key" to doc.key)
  }

  /**
   * Renders one page at [width] pixels. [mode]: 0 normal, 1 night (inverted, warm), 2 sepia.
   */
  fun render(context: Context, uriString: String, index: Int, width: Int, mode: Int): String? {
    val doc = synchronized(this) { docs[uriString] } ?: run {
      open(context, uriString)
      synchronized(this) { docs[uriString] }
    } ?: return null
    val dir = File(context.cacheDir, "mplayer-pdf/${doc.key}").apply { mkdirs() }
    val w = width.coerceIn(200, 4096)
    val target = File(dir, "p${index}_${w}_$mode.png")
    if (target.exists() && target.length() > 0) return Uri.fromFile(target).toString()

    var rendered: Bitmap? = null
    synchronized(doc) {
      if (index < 0 || index >= doc.renderer.pageCount) return null
      val page = doc.renderer.openPage(index)
      try {
        val h = (w.toFloat() * page.height / page.width).toInt().coerceAtLeast(1)
        val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        b.eraseColor(Color.WHITE)
        page.render(b, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        rendered = b
      } finally {
        page.close()
      }
    }
    val bitmap = rendered ?: return null
    val output = if (mode == 0) bitmap else tinted(bitmap, mode)
    return try {
      FileOutputStream(target).use { output.compress(Bitmap.CompressFormat.PNG, 100, it) }
      Uri.fromFile(target).toString()
    } catch (_: Throwable) {
      null
    } finally {
      if (output !== bitmap) output.recycle()
      bitmap.recycle()
    }
  }

  private fun tinted(src: Bitmap, mode: Int): Bitmap {
    val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
    val matrix = if (mode == 1) {
      // Inverted luminance with a slightly warm, low-contrast dark background.
      ColorMatrix(
        floatArrayOf(
          -0.86f, 0f, 0f, 0f, 236f,
          0f, -0.86f, 0f, 0f, 232f,
          0f, 0f, -0.86f, 0f, 226f,
          0f, 0f, 0f, 1f, 0f
        )
      )
    } else {
      ColorMatrix(
        floatArrayOf(
          0.393f, 0.769f, 0.189f, 0f, 0f,
          0.349f, 0.686f, 0.168f, 0f, 0f,
          0.272f, 0.534f, 0.131f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f
        )
      )
    }
    val paint = Paint().apply { colorFilter = ColorMatrixColorFilter(matrix) }
    Canvas(out).drawBitmap(src, 0f, 0f, paint)
    return out
  }

  @Synchronized
  fun close(uriString: String) {
    val doc = docs.remove(uriString) ?: return
    synchronized(doc) {
      try { doc.renderer.close() } catch (_: Throwable) {}
      try { doc.pfd.close() } catch (_: Throwable) {}
    }
  }

  fun clearCache(context: Context) {
    File(context.cacheDir, "mplayer-pdf").deleteRecursively()
  }
}
