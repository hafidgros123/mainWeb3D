import PageComments from '../../shared/PageComments'

// The comment section of one 3D model: "model:<id>" in the database.
function ModelComments({ modelId }) {
  return <PageComments sectionId={`model:${modelId}`} />
}

export default ModelComments
