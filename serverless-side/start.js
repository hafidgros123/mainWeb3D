import app from './server.js'
import { config } from './config.js'

app.listen(config.port, () => {
  console.log(`Backend running at http://localhost:${config.port} (model: ${config.modelName})`)
})
