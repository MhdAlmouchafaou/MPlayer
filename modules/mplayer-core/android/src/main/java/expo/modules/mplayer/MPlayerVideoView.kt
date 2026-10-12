@file:OptIn(UnstableApi::class)

package expo.modules.mplayer

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.SubtitleView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import org.videolan.libvlc.util.VLCVideoLayout
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import kotlin.math.max
import kotlin.math.min

/** Centres and sizes its single child according to the video aspect ratio and resize mode. */
class AspectFrame(context: Context) : ViewGroup(context) {
  var videoAspect = 0f
    set(value) {
      if (field != value) {
        field = value
        requestLayout()
      }
    }
  var mode = "fit"
    set(value) {
      if (field != value) {
        field = value
        requestLayout()
      }
    }

  private fun targetSize(w: Int, h: Int): Pair<Int, Int> {
    if (w == 0 || h == 0) return w to h
    val viewAspect = w.toFloat() / h
    val aspect = when (mode) {
      "16:9" -> 16f / 9f
      "4:3" -> 4f / 3f
      "stretch" -> return w to h
      else -> if (videoAspect > 0f) videoAspect else viewAspect
    }
    val cover = mode == "fill"
    val widthLimited = if (cover) aspect < viewAspect else aspect > viewAspect
    return if (widthLimited) w to (w / aspect).toInt() else (h * aspect).toInt() to h
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val w = MeasureSpec.getSize(widthMeasureSpec)
    val h = MeasureSpec.getSize(heightMeasureSpec)
    setMeasuredDimension(w, h)
    val (cw, ch) = targetSize(w, h)
    for (i in 0 until childCount) {
      getChildAt(i).measure(MeasureSpec.makeMeasureSpec(cw, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(ch, MeasureSpec.EXACTLY))
    }
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val w = r - l
    val h = b - t
    for (i in 0 until childCount) {
      val c = getChildAt(i)
      val left = (w - c.measuredWidth) / 2
      val top = (h - c.measuredHeight) / 2
      c.layout(left, top, left + c.measuredWidth, top + c.measuredHeight)
    }
  }
}

class MPlayerVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val root = FrameLayout(context).apply { setBackgroundColor(Color.BLACK) }
  private val aspect = AspectFrame(context)
  private val texture = TextureView(context)
  private val subtitles = SubtitleView(context)
  private var vlcLayout: VLCVideoLayout? = null
  private var attachedExo = false
  var engine = "none"
    private set

  private val listener = object : Player.Listener {
    override fun onVideoSizeChanged(videoSize: VideoSize) {
      if (videoSize.width > 0 && videoSize.height > 0) {
        aspect.videoAspect = videoSize.width * videoSize.pixelWidthHeightRatio / videoSize.height
      }
    }

    override fun onCues(cueGroup: CueGroup) {
      subtitles.setCues(cueGroup.cues)
    }
  }

  init {
    addView(root, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    aspect.addView(texture)
    root.addView(aspect, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    subtitles.setUserDefaultStyle()
    subtitles.setUserDefaultTextSize()
    subtitles.setApplyEmbeddedStyles(true)
    subtitles.setBottomPaddingFraction(0.06f)
    root.addView(subtitles, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    active = WeakReference(this)
  }

  fun setEngine(value: String) {
    if (value == engine) return
    detachEngine()
    engine = value
    if (isAttachedToWindow) attachEngine()
  }

  fun setResizeMode(value: String) {
    aspect.mode = value
    if (engine == "vlc") VlcEngine.setScale(value)
  }

  fun setSubtitleScale(scale: Float) {
    subtitles.setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * scale)
  }

  fun setSubtitleStyle(style: String) {
    val caption = when (style) {
      "box" -> CaptionStyleCompat(Color.WHITE, Color.argb(170, 0, 0, 0), Color.TRANSPARENT, CaptionStyleCompat.EDGE_TYPE_NONE, Color.BLACK, null)
      "yellow" -> CaptionStyleCompat(Color.rgb(255, 221, 64), Color.TRANSPARENT, Color.TRANSPARENT, CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, null)
      else -> CaptionStyleCompat(Color.WHITE, Color.TRANSPARENT, Color.TRANSPARENT, CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW, Color.BLACK, null)
    }
    subtitles.setStyle(caption)
  }

  private fun attachEngine() {
    when (engine) {
      "exo" -> {
        val p = PlayerHolder.get(context)
        aspect.visibility = View.VISIBLE
        subtitles.visibility = View.VISIBLE
        p.setVideoTextureView(texture)
        p.addListener(listener)
        val size = p.videoSize
        if (size.width > 0 && size.height > 0) aspect.videoAspect = size.width * size.pixelWidthHeightRatio / size.height
        attachedExo = true
      }
      "vlc" -> {
        aspect.visibility = View.GONE
        subtitles.visibility = View.GONE
        val layout = vlcLayout ?: VLCVideoLayout(context).also {
          vlcLayout = it
          root.addView(it, 0, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        layout.visibility = View.VISIBLE
        VlcEngine.attach(layout)
        VlcEngine.setScale(aspect.mode)
      }
    }
  }

  private fun detachEngine() {
    if (attachedExo) {
      PlayerHolder.peek()?.let {
        it.removeListener(listener)
        it.clearVideoTextureView(texture)
      }
      subtitles.setCues(emptyList())
      attachedExo = false
    }
    vlcLayout?.let {
      VlcEngine.detach(it)
      it.visibility = View.GONE
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    active = WeakReference(this)
    attachEngine()
  }

  override fun onDetachedFromWindow() {
    detachEngine()
    super.onDetachedFromWindow()
  }

  fun release() {
    detachEngine()
    if (active?.get() === this) active = null
  }

  private fun findTexture(v: View): TextureView? {
    if (v is TextureView) return v
    if (v is ViewGroup) for (i in 0 until v.childCount) findTexture(v.getChildAt(i))?.let { return it }
    return null
  }

  /** Grabs the frame on screen at full video resolution where possible. */
  fun captureBitmap(): Bitmap? {
    val tv = if (engine == "vlc") vlcLayout?.let { findTexture(it) } else texture
    tv ?: return null
    val p = PlayerHolder.peek()
    val vs = if (engine == "exo") p?.videoSize else null
    return if (vs != null && vs.width > 0 && vs.height > 0) {
      val scale = min(1f, 2160f / max(vs.width, vs.height))
      tv.getBitmap((vs.width * vs.pixelWidthHeightRatio * scale).toInt(), (vs.height * scale).toInt())
    } else {
      tv.bitmap
    }
  }

  companion object {
    var active: WeakReference<MPlayerVideoView>? = null

    /** Saves a bitmap in Pictures/MPlayer and returns its uri. */
    fun saveToGallery(context: Context, bitmap: Bitmap, name: String): String? {
      val fileName = "$name.jpg"
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MPlayer")
            put(MediaStore.Images.Media.IS_PENDING, 1)
          }
          val resolver = context.contentResolver
          val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null
          resolver.openOutputStream(uri)?.use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
          values.clear()
          values.put(MediaStore.Images.Media.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
          uri.toString()
        } else {
          @Suppress("DEPRECATION")
          val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "MPlayer").apply { mkdirs() }
          val file = File(dir, fileName)
          FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
          android.media.MediaScannerConnection.scanFile(context, arrayOf(file.path), arrayOf("image/jpeg"), null)
          android.net.Uri.fromFile(file).toString()
        }
      } catch (_: Throwable) {
        null
      }
    }
  }
}
