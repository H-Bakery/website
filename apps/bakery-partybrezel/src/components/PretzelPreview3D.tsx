'use client'
/**
 * Drehbare 3D-Ansicht einer Partybrezel (three.js). Wird nur über
 * `PretzelView` per next/dynamic nachgeladen - three ist nicht im ersten
 * Bundle. Die Geometrie rechnet `src/lib/pretzel3d.ts`; hier entstehen nur
 * Szene, Licht, Materialien und Bedienung.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import PauseIcon from '@mui/icons-material/Pause'
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  PartybrezelConfig,
  SizeConfig,
  ToppingConfig,
} from '../config/partybrezel.config'
import {
  describePretzel3D,
  partMeshes,
  saltCrystals,
  type MeshData,
  type Pretzel3DDescription,
} from '../lib/pretzel3d'

export interface PretzelPreview3DProps {
  /** Je Teil der gewählte Belag oder `undefined` (offen). */
  parts: (ToppingConfig | undefined)[]
  size: SizeConfig
  config: PartybrezelConfig
  /** z. B. "Brezel 1 (groß)". */
  label: string
  /** Der Renderer startet nicht (kein WebGL 2): die Seite zeigt dann 2D. */
  onUnavailable: () => void
  /** Der Kontext ging verloren (vorübergehend): die Seite zeigt vorerst 2D. */
  onInterrupted: () => void
  /** Nach „In 3D ansehen“: Fokus auf die Bedienung, statt ihn zu verlieren. */
  focusOnMount?: boolean
  /** Der Fokus wurde gesetzt (damit er nur einmal springt). */
  onFocused?: () => void
}

const ROTATE_STEP = Math.PI / 6
const AUTO_ROTATE_SPEED = 2
/** Eine Umdrehung (Bogenmaß), danach hält die Auto-Drehung an. */
const FULL_TURN = 2 * Math.PI
/** Kamera: Abstand und Neigung (0 = senkrecht von oben). */
const CAMERA_DISTANCE = 4.1
const CAMERA_TILT = 0.7
/** Nie so nah, dass die große Brezel an den Rändern abgeschnitten wird. */
const MIN_DISTANCE = 3.4
/** Halbe Breite der großen Brezel samt Füllung (Weltmaß), für den Zoom. */
const HALF_WIDTH = 1.3
/** Kruste: helle Unterseite, goldbraune Flanke, dunkle Laugenkruste oben. */
const CRUST_UNDER = '#c98a4b'
const CRUST_SIDE = '#9a5a24'
const CRUST_TOP = '#5a2b10'
const CRUMB = '#ecd5a8'
const AUSBUND = '#d29a5c'

interface SceneHandle {
  setPretzel: (d: Pretzel3DDescription) => void
  rotate: (angle: number) => void
  reset: () => void
  setAutoRotate: (on: boolean) => void
  dispose: () => void
}

function crustColors(mesh: MeshData): Float32Array {
  const { shade, ausbund } = mesh
  const under = new THREE.Color(CRUST_UNDER)
  const side = new THREE.Color(CRUST_SIDE)
  const top = new THREE.Color(CRUST_TOP)
  const light = new THREE.Color(AUSBUND)
  const c = new THREE.Color()
  const out = new Float32Array(shade.length * 3)
  for (let i = 0; i < shade.length; i += 1) {
    const s = shade[i]
    if (s < 0.35) c.lerpColors(under, side, s / 0.35)
    else c.lerpColors(side, top, (s - 0.35) / 0.65)
    if (ausbund[i] > 0) c.lerp(light, ausbund[i] * 0.9)
    out[i * 3] = c.r
    out[i * 3 + 1] = c.g
    out[i * 3 + 2] = c.b
  }
  return out
}

const colorCache = new WeakMap<MeshData, Float32Array>()

function toGeometry(mesh: MeshData): THREE.BufferGeometry {
  let colors = colorCache.get(mesh)
  if (!colors) {
    colors = crustColors(mesh)
    colorCache.set(mesh, colors)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  for (const grp of mesh.groups)
    g.addGroup(grp.start, grp.count, grp.materialIndex)
  g.computeBoundingSphere()
  return g
}

function shadowTexture(): THREE.Texture | null {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.38)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.16)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/**
 * Baut die Szene in `container`. Wirft, wenn kein WebGL-Kontext entsteht.
 * Jeder Aufruf hat ein eigenes Canvas: ein per forceContextLoss
 * freigegebenes Canvas ließe sich (StrictMode: zweites Mounten) nicht
 * wiederverwenden.
 */
function createScene(
  container: HTMLDivElement,
  options: {
    label: string
    badges: () => (HTMLElement | null)[]
    onLost: () => void
    onAutoRotate: (on: boolean) => void
  }
): SceneHandle {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', options.label)
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.outline = 'none'
  container.prepend(canvas)

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    })
  } catch (err) {
    canvas.remove()
    throw err
  }
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  const target = new THREE.Vector3(0, 0.08, 0.06)
  camera.position.copy(
    new THREE.Vector3()
      .setFromSphericalCoords(CAMERA_DISTANCE, CAMERA_TILT, 0)
      .add(target)
  )
  camera.lookAt(target)

  scene.add(new THREE.HemisphereLight(0xfff3e2, 0x5a3b22, 1.35))
  const key = new THREE.DirectionalLight(0xffffff, 1.8)
  key.position.set(2.2, 4.5, 2.6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -1.8
  key.shadow.camera.right = 1.8
  key.shadow.camera.top = 1.8
  key.shadow.camera.bottom = -1.8
  key.shadow.camera.near = 1
  key.shadow.camera.far = 12
  key.shadow.radius = 6
  key.shadow.bias = -0.0008
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffe0bd, 0.7)
  fill.position.set(-3, 2, -1.5)
  scene.add(fill)
  // Gegenlicht: heller Rand, damit sich die dunkle Kruste auch im
  // Dunkelmodus vom Hintergrund abhebt.
  const rim = new THREE.DirectionalLight(0xfff0dc, 1.1)
  rim.position.set(-0.8, 2.2, -4)
  scene.add(rim)

  // Schatten: weicher Fleck + echter Schatten des Hauptlichts.
  const blobTexture = shadowTexture()
  const blobMaterial = new THREE.MeshBasicMaterial({
    map: blobTexture,
    transparent: true,
    depthWrite: false,
    opacity: blobTexture ? 1 : 0,
  })
  const planeGeometry = new THREE.PlaneGeometry(1, 1)
  const blob = new THREE.Mesh(planeGeometry, blobMaterial)
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.001
  blob.renderOrder = -1
  scene.add(blob)
  const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.2 })
  const ground = new THREE.Mesh(planeGeometry, shadowMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.scale.set(6, 6, 1)
  ground.receiveShadow = true
  scene.add(ground)

  const crust = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
  })
  const crumb = new THREE.MeshStandardMaterial({
    color: CRUMB,
    roughness: 0.95,
    metalness: 0,
  })
  const salt = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0,
    emissive: 0x1a1a1a,
  })
  const saltGeometry = new THREE.OctahedronGeometry(1, 0)

  const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const reduced = Boolean(reducedQuery?.matches)

  const controls = new OrbitControls(camera, canvas)
  controls.target.copy(target)
  controls.enablePan = false
  controls.enableDamping = !reduced
  controls.dampingFactor = 0.08
  controls.minDistance = MIN_DISTANCE
  controls.maxDistance = 7
  controls.minPolarAngle = 0.15
  controls.maxPolarAngle = 1.3
  controls.rotateSpeed = 0.8
  controls.autoRotate = false
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED
  // Senkrecht wischen scrollt auf dem Handy die Seite (sonst bliebe sie am
  // Bild hängen); seitlich ziehen dreht. OrbitControls setzt sonst 'none'.
  canvas.style.touchAction = 'pan-y'
  controls.update()
  controls.saveState()

  let pretzel: THREE.Group | null = null
  let anchors: THREE.Vector3[] = []
  /** Mitte der Brezel im Grundriss: für „Teil liegt hinten“. */
  const middle = new THREE.Vector3()
  const view = new THREE.Vector3()
  let raf = 0
  let last = 0
  let needsRender = true
  let onScreen = true
  let pageVisible = !document.hidden
  let width = 0
  let height = 0
  /** Bisher automatisch gedrehter Winkel; nach einer Umdrehung ist Schluss. */
  let turned = 0
  const projected = new THREE.Vector3()

  const setAutoRotate = (on: boolean) => {
    if (controls.autoRotate === on) return
    controls.autoRotate = on
    turned = 0
    options.onAutoRotate(on)
    if (on) requestRender()
  }

  const placeBadges = () => {
    const els = options.badges()
    view.subVectors(camera.position, controls.target)
    const level = Math.hypot(view.x, view.z)
    // von oben gesehen liegt kein Teil „hinten“
    const sideways = level / (view.length() || 1)
    anchors.forEach((a, i) => {
      const el = els[i]
      if (!el || width === 0) return
      projected.copy(a).project(camera)
      el.style.left = `${((projected.x + 1) / 2) * width}px`
      el.style.top = `${((1 - projected.y) / 2) * height}px`
      el.style.visibility = 'visible'
      // Nummern von Teilen auf der abgewandten Seite blassen aus, statt
      // über dem vorderen Teil zu schweben.
      const ox = a.x - middle.x
      const oz = a.z - middle.z
      const off = Math.hypot(ox, oz)
      const away =
        off < 1e-3 || level < 1e-3
          ? 0
          : (-(ox * view.x + oz * view.z) / (off * level)) *
            sideways *
            Math.min(1, off / 0.5)
      const fade = THREE.MathUtils.smoothstep(away, 0.2, 0.75)
      el.style.opacity = String(1 - 0.7 * fade)
    })
  }

  const render = () => {
    if (width === 0 || height === 0) return
    renderer.render(scene, camera)
    placeBadges()
  }

  const tick = (time: number) => {
    raf = 0
    const delta = last ? Math.min((time - last) / 1000, 0.1) : 1 / 60
    last = time
    const moved = controls.update(delta)
    if (controls.autoRotate) {
      // gleiche Rechnung wie OrbitControls' Auto-Drehung
      turned += ((2 * Math.PI) / 60) * controls.autoRotateSpeed * delta
      if (turned >= FULL_TURN) setAutoRotate(false)
    }
    if (moved || needsRender) {
      needsRender = false
      render()
    }
    // Nur weiterlaufen, solange sich etwas bewegt (Auto-Drehung, Ausrollen).
    if (moved || controls.autoRotate) schedule()
    else last = 0
  }

  function schedule() {
    if (raf || !onScreen || !pageVisible) return
    raf = requestAnimationFrame(tick)
  }

  const requestRender = () => {
    needsRender = true
    schedule()
  }

  const stopAutoRotate = () => setAutoRotate(false)
  controls.addEventListener('start', stopAutoRotate)
  controls.addEventListener('change', requestRender)

  // Mausrad scrollt die Seite; gezoomt wird mit Strg/⌘ + Rad (auch
  // Trackpad-Pinch). Sonst bliebe die Seite beim Scrollen am Bild hängen.
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation()
  }
  container.addEventListener('wheel', onWheel, { capture: true })

  const onReducedChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      setAutoRotate(false)
      controls.enableDamping = false
    }
  }
  reducedQuery?.addEventListener?.('change', onReducedChange)

  const resize = () => {
    const rect = container.getBoundingClientRect()
    width = Math.round(rect.width)
    height = Math.round(rect.height)
    if (width === 0 || height === 0) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Hochkant (schmale Spalte): weiter weg, damit die Brezel ganz drauf ist.
    camera.fov = camera.aspect < 1 ? 30 / Math.max(camera.aspect, 0.6) : 30
    camera.updateProjectionMatrix()
    // Schmaleres Bild (Handy, 4:3): der Zoom hält auch seitlich Abstand.
    const halfWidth =
      Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.aspect
    controls.minDistance = Math.max(MIN_DISTANCE, HALF_WIDTH / halfWidth)
    controls.update()
    requestRender()
  }
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(container)
  resize()

  const intersection =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          onScreen = entries.some((e) => e.isIntersecting)
          if (onScreen) requestRender()
          else if (raf) {
            cancelAnimationFrame(raf)
            raf = 0
            last = 0
          }
        })
      : null
  intersection?.observe(container)

  const onVisibility = () => {
    pageVisible = !document.hidden
    if (pageVisible) requestRender()
    else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
      last = 0
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const onLost = () => options.onLost()
  canvas.addEventListener('webglcontextlost', onLost)

  const disposePretzel = () => {
    if (!pretzel) return
    pretzel.traverse((obj) => {
      // gibt den Instanz-Puffer auf der GPU frei (sonst bliebe er je Wechsel)
      if (obj instanceof THREE.InstancedMesh) obj.dispose()
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry !== saltGeometry) obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats)
          if (m !== crust && m !== crumb && m !== salt) m.dispose()
      }
    })
    scene.remove(pretzel)
    pretzel = null
  }

  // Eine Umdrehung zum Kennenlernen, nicht bei reduzierter Bewegung.
  if (!reduced) setAutoRotate(true)

  return {
    setPretzel(d) {
      disposePretzel()
      const group = new THREE.Group()
      const meshes = partMeshes(d.parts.length)
      d.parts.forEach((part, i) => {
        const filling = new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: part.toppingId ? 0.6 : 0.9,
          metalness: 0,
        })
        const mesh = new THREE.Mesh(toGeometry(meshes[i]), [
          crust,
          crumb,
          filling,
        ])
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      })
      const crystals = saltCrystals(d.parts.length)
      const saltMesh = new THREE.InstancedMesh(
        saltGeometry,
        salt,
        crystals.length
      )
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const e = new THREE.Euler()
      const p = new THREE.Vector3()
      const s = new THREE.Vector3()
      crystals.forEach((c, i) => {
        e.set(...c.rotation)
        q.setFromEuler(e)
        p.set(...c.position)
        s.set(c.size, c.size * 0.75, c.size)
        saltMesh.setMatrixAt(i, m.compose(p, q, s))
      })
      saltMesh.instanceMatrix.needsUpdate = true
      group.add(saltMesh)
      group.scale.setScalar(d.scale)
      scene.add(group)
      pretzel = group

      const { minX, maxX, minZ, maxZ } = d.bounds
      blob.scale.set(
        (maxX - minX) * d.scale * 1.25,
        (maxZ - minZ) * d.scale * 1.35,
        1
      )
      blob.position.x = ((minX + maxX) / 2) * d.scale
      blob.position.z = ((minZ + maxZ) / 2) * d.scale
      middle.set(blob.position.x, 0, blob.position.z)
      anchors = d.parts.map((part) =>
        new THREE.Vector3(...part.anchor).multiplyScalar(d.scale)
      )
      canvas.setAttribute('aria-label', d.ariaLabel)
      requestRender()
    },
    rotate(angle) {
      setAutoRotate(false)
      controls.rotateLeft(angle)
      requestRender()
    },
    reset() {
      setAutoRotate(false)
      controls.reset()
      requestRender()
    },
    setAutoRotate,
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      canvas.removeEventListener('webglcontextlost', onLost)
      container.removeEventListener('wheel', onWheel, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
      reducedQuery?.removeEventListener?.('change', onReducedChange)
      resizeObserver?.disconnect()
      intersection?.disconnect()
      controls.removeEventListener('start', stopAutoRotate)
      controls.removeEventListener('change', requestRender)
      controls.dispose()
      disposePretzel()
      saltGeometry.dispose()
      planeGeometry.dispose()
      blobTexture?.dispose()
      for (const mat of [blobMaterial, shadowMaterial, crust, crumb, salt])
        mat.dispose()
      key.shadow.map?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}

export default function PretzelPreview3D({
  parts,
  size,
  config,
  label,
  onUnavailable,
  onInterrupted,
  focusOnMount = false,
  onFocused,
}: PretzelPreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const sceneRef = useRef<SceneHandle | null>(null)
  const badgeRefs = useRef<(HTMLElement | null)[]>([])
  const callbacks = useRef({ onUnavailable, onInterrupted, onFocused })
  callbacks.current = { onUnavailable, onInterrupted, onFocused }
  const [spinning, setSpinning] = useState(false)
  // Touch-Geräte haben weder Mausrad noch Strg-Taste: eigener Hinweis.
  const [coarse] = useState(
    () => window.matchMedia?.('(pointer: coarse)').matches ?? false
  )

  const toppingKey = parts.map((t) => t?.id ?? '').join('|')
  const description = useMemo(
    () => describePretzel3D({ parts, size, config, label }),
    // parts ist je Render ein neues Array - entscheidend sind die IDs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toppingKey, size, config, label]
  )
  const descriptionRef = useRef(description)
  descriptionRef.current = description

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let handle: SceneHandle
    try {
      handle = createScene(container, {
        label: descriptionRef.current.ariaLabel,
        badges: () => badgeRefs.current,
        onLost: () => callbacks.current.onInterrupted(),
        onAutoRotate: setSpinning,
      })
    } catch {
      callbacks.current.onUnavailable()
      return
    }
    sceneRef.current = handle
    // Die Brezel baut der Effekt unten (er läuft auch beim ersten Mounten).
    return () => {
      sceneRef.current = null
      handle.dispose()
    }
  }, [])

  useEffect(() => {
    if (!focusOnMount) return
    firstButtonRef.current?.focus()
    callbacks.current.onFocused?.()
    // nur beim Erscheinen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Belag oder Größe geändert: nur die Brezel neu bauen, nicht den Renderer.
  useEffect(() => {
    sceneRef.current?.setPretzel(description)
  }, [description])

  const buttonSx = { color: 'text.primary' }

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        ref={containerRef}
        data-testid="pretzel-3d"
        sx={{
          position: 'relative',
          width: '100%',
          // Handy: höher, damit die Brezel die schmale Spalte füllt.
          aspectRatio: { xs: '4 / 3', sm: '16 / 10' },
          maxHeight: 400,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          borderRadius: 2,
        }}
      >
        {description.parts.map((p, i) => (
          <Box
            key={p.number}
            ref={(el: HTMLElement | null) => {
              badgeRefs.current[i] = el
            }}
            aria-hidden="true"
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              visibility: 'hidden',
              transform: 'translate(-50%, -50%)',
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: 1.5,
              borderColor: 'text.primary',
              // Ring in der Belagsfarbe: verbindet Nummer und Füllung.
              boxShadow: `inset 0 0 0 3px ${p.color}`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {p.number}
          </Box>
        ))}
      </Box>
      <Box
        role="group"
        aria-label={`3D-Ansicht von ${label} bedienen`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        {/* rotateLeft(+) dreht die Brezel von oben gesehen gegen den
            Uhrzeigersinn - „nach rechts“ (↻) ist also das Minus. */}
        <Tooltip title="Nach links drehen">
          <IconButton
            ref={firstButtonRef}
            aria-label="Nach links drehen"
            onClick={() => sceneRef.current?.rotate(ROTATE_STEP)}
            sx={buttonSx}
          >
            <RotateLeftIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Ansicht zurücksetzen">
          <IconButton
            aria-label="Ansicht zurücksetzen"
            onClick={() => sceneRef.current?.reset()}
            sx={buttonSx}
          >
            <CenterFocusStrongIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nach rechts drehen">
          <IconButton
            aria-label="Nach rechts drehen"
            onClick={() => sceneRef.current?.rotate(-ROTATE_STEP)}
            sx={buttonSx}
          >
            <RotateRightIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={spinning ? 'Drehung anhalten' : 'Einmal rundum drehen'}>
          <IconButton
            aria-label={spinning ? 'Drehung anhalten' : 'Einmal rundum drehen'}
            onClick={() => sceneRef.current?.setAutoRotate(!spinning)}
            sx={buttonSx}
          >
            {spinning ? <PauseIcon /> : <ThreeSixtyIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ textAlign: 'center', m: 0 }}
      >
        {coarse ? (
          'Schematische Darstellung. Zum Drehen seitlich wischen oder die Knöpfe nutzen.'
        ) : (
          <>
            Schematische Darstellung. Zum Drehen ziehen, zum Zoomen{' '}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              Strg/⌘ + Mausrad
            </Box>
            .
          </>
        )}
      </Typography>
    </Box>
  )
}
