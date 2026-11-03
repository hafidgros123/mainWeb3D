import { useState } from 'react'

const PREVIEW_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg']

function getPreviewBaseName(modelPath) {
  const fileName = modelPath.split('/').pop() || ''
  return fileName.replace(/\.[^.]+$/, '')
}

function ModelPreview({ model }) {
  const baseName = getPreviewBaseName(model.model)
  const [extensionIndex, setExtensionIndex] = useState(0)
  const previewPath = `/models/small%20version/${baseName}.${PREVIEW_EXTENSIONS[extensionIndex]}`

  if (extensionIndex >= PREVIEW_EXTENSIONS.length) {
    return (
      <div className="model-preview-placeholder" aria-hidden="true">
        <span>Add preview image</span>
      </div>
    )
  }

  return (
    <img
      className="model-preview-image"
      src={previewPath}
      alt={`${model.title} preview`}
      onError={() => setExtensionIndex((index) => index + 1)}
    />
  )
}

export default ModelPreview
