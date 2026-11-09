import { useEffect, useRef, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'

function ModelViewer({ model }) {
  const canvasRef = useRef(null)
  const autoRotateRef = useRef(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [status, setStatus] = useState('loading')
  const [loadProgress, setLoadProgress] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#526166')
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
    camera.position.set(2.8, 1.8, 3.2)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 0.1
    controls.maxDistance = 100
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight('#fff7e8', '#354247', 2.8))
    const keyLight = new THREE.DirectionalLight('#ffffff', 3)
    keyLight.position.set(4, 6, 5)
    scene.add(keyLight)

    const loader = new GLTFLoader()
    let loadedObject
    const frame = { id: null }
    let intersectsViewport = true
    const lifecycle = { cancelled: false }

    loader.load(
      model.model,
      (gltf) => {
        if (lifecycle.cancelled) return
        setLoadProgress(100)
        loadedObject = gltf.scene
        loadedObject.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false
            child.receiveShadow = false
          }
        })
        scene.add(loadedObject)

        const box = new THREE.Box3().setFromObject(loadedObject)
        const center = box.getCenter(new THREE.Vector3())
        loadedObject.position.sub(center)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const radius = Math.max(sphere.radius, 0.01)
        const distance = (radius / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 1.25
        const viewDirection = new THREE.Vector3(2.8, 1.8, 3.2).normalize()

        camera.position.copy(viewDirection).multiplyScalar(distance)
        camera.near = Math.max(radius / 100, 0.001)
        camera.far = Math.max(radius * 100, 100)
        camera.updateProjectionMatrix()
        controls.target.set(0, 0, 0)
        controls.minDistance = radius * 0.2
        controls.maxDistance = radius * 20
        setStatus('ready')
      },
      (progressEvent) => {
        if (progressEvent.total > 0) {
          setLoadProgress(Math.min(100, (progressEvent.loaded / progressEvent.total) * 100))
        }
      },
      (error) => {
        console.error(`Could not load 3D model: ${model.model}`, error)
        if (!lifecycle.cancelled) setStatus('error')
      },
    )

    function resize() {
      const { clientWidth, clientHeight } = canvas.parentElement
      camera.aspect = clientWidth / Math.max(clientHeight, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight, false)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement)
    resize()

    function stopAnimation() {
      if (frame.id === null) return
      cancelAnimationFrame(frame.id)
      frame.id = null
    }

    function animate() {
      frame.id = null
      if (lifecycle.cancelled || !intersectsViewport || document.hidden) return
      if (loadedObject && autoRotateRef.current) loadedObject.rotation.y += 0.005
      controls.update()
      renderer.render(scene, camera)
      frame.id = requestAnimationFrame(animate)
    }

    function syncAnimation() {
      if (intersectsViewport && !document.hidden && frame.id === null) {
        frame.id = requestAnimationFrame(animate)
      } else if (!intersectsViewport || document.hidden) {
        stopAnimation()
      }
    }

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      intersectsViewport = entry.isIntersecting
      syncAnimation()
    })
    visibilityObserver.observe(canvas)
    document.addEventListener('visibilitychange', syncAnimation)
    syncAnimation()

    return () => {
      lifecycle.cancelled = true
      stopAnimation()
      document.removeEventListener('visibilitychange', syncAnimation)
      visibilityObserver.disconnect()
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse((object) => {
        if (!object.isMesh) return
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material.dispose()
      })
    }
  }, [model.model])

  return (
    <section className="model-viewer" aria-label={`${model.title} 3D viewer`}>
      <canvas ref={canvasRef} />
      {status === 'loading' && (
        <div className="viewer-status viewer-loading">
          <img src="/orbit/turn.webp" alt="" aria-hidden="true" />
          <span>Loading model...</span>
          <div className="model-load-bar" role="progressbar" aria-label="Model loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(loadProgress)}>
            <span style={{ width: `${loadProgress}%` }} />
          </div>
        </div>
      )}
      {status === 'error' && (
        <p className="viewer-status viewer-status-error">
          This model could not be loaded. Check that the `.glb` file exists in `public/models/`.
        </p>
      )}
      <div className="viewer-controls">
        <button
          type="button"
          onClick={() => setAutoRotate((value) => {
            autoRotateRef.current = !value
            return !value
          })}
        >
          {autoRotate ? 'Pause rotation' : 'Auto-rotate'}
        </button>
        <span>Drag to rotate · Scroll to zoom</span>
      </div>
    </section>
  )
}

export default ModelViewer
