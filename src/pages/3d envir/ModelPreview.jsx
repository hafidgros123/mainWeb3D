import { useState } from 'react'

const PREVIEW_FORMATS = [
  { extension: 'webp', type: 'image' },
  { extension: 'mp4', type: 'video' },
]

function getPreviewBaseName(modelPath) {
  const fileName = modelPath.split('/').pop() || ''
  return fileName.replace(/\.[^.]+$/, '')
}

function ModelPreview({ model }) {
  const baseName = getPreviewBaseName(model.model)
  const [formatIndex, setFormatIndex] = useState(0)

  if (formatIndex >= PREVIEW_FORMATS.length) {
    return (
      <div className="model-preview-placeholder" aria-hidden="true">
        <span>Add .webp or .mp4 preview</span>
      </div>
    )
  }

  const format = PREVIEW_FORMATS[formatIndex]
  const previewPath = `/models/small%20version/${baseName}.${format.extension}`
  const handlePreviewError = () => setFormatIndex((index) => index + 1)

  if (format.type === 'video') {
    return (
      <video
        className="model-preview-video"
        src={previewPath}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-label={`${model.title} preview`}
        onError={handlePreviewError}
      />
    )
  }

  return (
    <img
      className="model-preview-image"
      src={previewPath}
      alt={`${model.title} preview`}
      onError={handlePreviewError}
    />
  )
}

export default ModelPreview
