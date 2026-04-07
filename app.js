import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js'
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/webxr/ARButton.js'

const params = new URLSearchParams(location.search)
const productSize = "<?php echo $productSize; ?>"
const productImg  = "<?php echo $productImg; ?>"

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

if (isIOS) {
  startIOSCamera()
}
async function startIOSCamera() {
  const video = document.createElement("video")
  video.setAttribute("autoplay", "")
  video.setAttribute("muted", "")
  video.setAttribute("playsinline", "")

  video.style.position = "fixed"
  video.style.top = "0"
  video.style.left = "0"
  video.style.width = "100%"
  video.style.height = "100%"
  video.style.objectFit = "cover"
  video.style.zIndex = "-1"

  document.body.appendChild(video)

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    })

    video.srcObject = stream
  } catch (err) {
    alert("Camera access denied")
  }
}
function getIOSPlacementPosition() {
  const pos = new THREE.Vector3()
  const dir = new THREE.Vector3()

  camera.getWorldPosition(pos)
  camera.getWorldDirection(dir)

  // 🔥 fixed distance from camera
  const distance = 1.2 + (points.length * 0.02)

  pos.add(dir.multiplyScalar(distance))

  // 🔥 LOCK to flat ground plane
  pos.y = -0.5   // ← adjust once, stays consistent

  return pos
}
// -------- ANDROID --------
// -------- CONFIG --------
let TILE_SIZE_CM = 60

if (productSize && productSize.includes("X")) {
  const parts = productSize.split("X").map(Number)
  TILE_SIZE_CM = parts[0]
} // change dynamically later
let scaleFactor = 1
let calibrationMode = true
let calibrationPoints = []

// -------- THREE --------
let scene = new THREE.Scene()
let camera = new THREE.PerspectiveCamera()
let renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true })

scene.add(camera)

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.xr.enabled = !isIOS
document.body.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1))

// -------- STATE --------
let points=[], lines=[], labels=[]
let tileMesh=null
let lastPos=null
let previewLine = null
let previewPoint = null
const SNAP = 0.05



// -------- RETICLE --------
let reticle = new THREE.Group()

const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
)

const dot = new THREE.Mesh(
  new THREE.SphereGeometry(0.01, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
)

reticle.add(ring)
reticle.add(dot)

reticle.visible = false
scene.add(reticle)
reticle.matrixAutoUpdate = false

// -------- PREVIEW LINE --------
const previewMaterial = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 0.05,
  gapSize: 0.03
})

previewLine = new THREE.Line(
  new THREE.BufferGeometry(),
  previewMaterial
)

scene.add(previewLine)

previewPoint = new THREE.Mesh(
  new THREE.SphereGeometry(0.008),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
)

scene.add(previewPoint)

// -------- XR SETUP --------
if (!isIOS) {
  document.body.appendChild(
    ARButton.createButton(renderer,{requiredFeatures:['hit-test']})
  )
}

// -------- HELPERS --------
function smooth(pos){
  if(!lastPos) return pos
  return lastPos.clone().lerp(pos,0.7)
}

function snap(pos){
  for(let p of points){
    const dx = Math.abs(p.position.x - pos.x)
    const dz = Math.abs(p.position.z - pos.z)

    if (dx < SNAP) pos.x = p.position.x
    if (dz < SNAP) pos.z = p.position.z
  }
  return pos
}

function label(text,pos){
  const c=document.createElement('canvas')
  const ctx=c.getContext('2d')
  c.width=200; c.height=80
  ctx.fillStyle="white"; ctx.fillRect(0,0,200,80)
  ctx.fillStyle="black"; ctx.fillText(text,20,50)

  const tex=new THREE.CanvasTexture(c)
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex}))
  s.scale.set(0.2,0.1,1)
  s.position.copy(pos)
  return s
}

// -------- PLACE --------

function placePoint(){
  let pos=new THREE.Vector3()

   // ✅ SET POSITION FIRST
  if (isIOS) {
    pos.copy(getIOSPlacementPosition())
  } else if (reticle.visible) {
    pos.setFromMatrixPosition(reticle.matrix)
  }

  if (isIOS && calibrationMode) {
  calibrationPoints.push(pos.clone())

  if (calibrationPoints.length === 2) {
    const measured = calibrationPoints[0].distanceTo(calibrationPoints[1])

    const realDistance = parseFloat(
      prompt("Enter real distance in METERS (example: 0.6)")
    )

    if (!isNaN(realDistance) && realDistance > 0) {
  scaleFactor = realDistance / measured
  alert("Calibration complete ✅")
} else {
  alert("Invalid input")
}

    calibrationMode = false
    calibrationPoints = []

    alert("Calibration complete ✅")
  }

  return
}
pos = snap(pos)
pos = smartSnap(pos)

// ✅ ADD SMOOTHING HERE
if (lastPos) {
  pos.lerp(lastPos, 0.7)
}

lastPos = pos.clone()

  // -------- CALIBRATION --------


  if (calibrationMode) {
  info.innerText = "Calibrate: tap 2 points on a known size"
} else if (points.length < 2) {
  info.innerText = "Tap to start measuring"
} else {
  info.innerText = "Continue placing points"
}

  // -------- ADD POINT --------
  const p=new THREE.Mesh(
    new THREE.SphereGeometry(0.01),
    new THREE.MeshBasicMaterial({color:0xff0000})
  )
  p.position.copy(pos)
  scene.add(p)
  points.push(p)

  if(points.length>=2){
    const a=points[points.length-2].position
    const b=points[points.length-1].position

    const line=new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a,b]),
      new THREE.LineBasicMaterial()
    )
    scene.add(line)
    lines.push(line)

    const dist=a.distanceTo(b)*scaleFactor

    const l=label(dist.toFixed(2)+"m",
      a.clone().add(b).multiplyScalar(0.5)
    )
    scene.add(l)
    labels.push(l)
  }

  updateTile()
}

// -------- TILE + AREA --------
function updateTile(){
  if(tileMesh) scene.remove(tileMesh)
  if(points.length<3) return

  const shape=new THREE.Shape(
    points.map(p=>new THREE.Vector2(p.position.x,p.position.z))
  )

  const geo=new THREE.ShapeGeometry(shape)

  const tex = new THREE.TextureLoader().load(productImg || 'fallback.jpg')
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping

  const sizeMeters = TILE_SIZE_CM / 100
  const box = new THREE.Box3().setFromPoints(
  points.map(p => new THREE.Vector3(p.position.x, 0, p.position.z))
)

const size = new THREE.Vector3()
box.getSize(size)

tex.repeat.set(
  size.x / sizeMeters,
  size.z / sizeMeters
)

  tileMesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
    map:tex, side:THREE.DoubleSide
  }))
  tileMesh.rotation.x=-Math.PI/2

  scene.add(tileMesh)

  showArea()
}

// -------- AREA --------
function showArea(){
  let area=0
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length
    area+=points[i].position.x*points[j].position.z
    area-=points[j].position.x*points[i].position.z
  }
  area=Math.abs(area/2)*scaleFactor

  const tiles = area / Math.pow(TILE_SIZE_CM/100,2)

  info.innerText =
    "Area: "+area.toFixed(2)+" m² | Tiles: "+Math.ceil(tiles)
}

// -------- CONFIRM --------
function confirmMeasurement(){
  if(points.length < 3) {
    alert("Place at least 3 points")
    return
  }

  // 📸 TAKE SCREENSHOT FIRST
  takeScreenshot()

  // -------- EXISTING LOGIC --------
  let edges = []

  for(let i=0;i<points.length;i++){
    const a = points[i].position
    const b = points[(i+1)%points.length].position
    edges.push(a.distanceTo(b) * scaleFactor)
  }

  edges.sort((a,b)=>b-a)

  const length = edges[0]
  const width  = edges[1]

  sendToParent(length, width)
}

// -------- XR LOOP --------
let hitSource=null, requested=false

renderer.setAnimationLoop((t,frame)=>{
  if (frame) {
  const session = renderer.xr.getSession()
  const ref = renderer.xr.getReferenceSpace()

  if (!requested) {
    session.requestReferenceSpace('viewer').then(s => {
      session.requestHitTestSource({ space: s }).then(src => hitSource = src)
    })
    requested = true
  }

  let placed = false

  if (hitSource) {
    const hits = frame.getHitTestResults(hitSource)

    if (hits.length) {
      const pose = hits[0].getPose(ref)

      reticle.visible = true
      reticle.matrixAutoUpdate = false
      reticle.matrix.fromArray(pose.transform.matrix)

      placed = true
    }
  }

  // ✅ Emulator + fallback mode
  if (!placed) {
  const camPos = new THREE.Vector3()
  const camDir = new THREE.Vector3()

  camera.getWorldPosition(camPos)
  camera.getWorldDirection(camDir)

  camPos.add(camDir.multiplyScalar(1.2))

  reticle.visible = true

  reticle.matrix.setPosition(camPos)
  reticle.lookAt(camPos.clone().add(camDir))
}}
renderer.xr.addEventListener("sessionstart", () => {
  const session = renderer.xr.getSession()

  session.addEventListener("select", () => {
    handleTap()
  })
})

  // -------- LIVE PREVIEW --------
if (points.length > 0) {
  let currentPos = new THREE.Vector3()

  if (isIOS) {
    currentPos.copy(getIOSPlacementPosition())
  } else if (reticle.visible) {
    currentPos.setFromMatrixPosition(reticle.matrix)
  }

  const last = points[points.length - 1].position

  previewLine.geometry.setFromPoints([last, currentPos])
  previewLine.computeLineDistances()

  previewPoint.position.copy(currentPos)
}

if (points.length === 0) {
  previewLine.visible = false
  previewPoint.visible = false
} else {
  previewLine.visible = true
  previewPoint.visible = true
}

  renderer.render(scene,camera)
})

// -------- UNDO / CLEAR --------
function undo(){
  if(points.length) scene.remove(points.pop())
  if(lines.length) scene.remove(lines.pop())
  if(labels.length) scene.remove(labels.pop())
}

function clearAll(){
  points.forEach(p=>scene.remove(p))
  lines.forEach(l=>scene.remove(l))
  labels.forEach(l=>scene.remove(l))
  points=[]; lines=[]; labels=[]
}

function sendToParent(length, width) {

  const data = {
    type: 'ar-measurement',
    length: parseFloat(length.toFixed(2)),
    width: parseFloat(width.toFixed(2)),
    productId: params.get('id'),
    session: params.get('session')
  }

  // ✅ Try postMessage first
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(data, "*")
    alert("Measurement sent!")
    window.close()
    return
  }

  // ✅ Fallback redirect
  const url = `ProductDetails.php?id=${data.productId}&length=${data.length}&width=${data.width}`
  window.location.href = url
}

function takeScreenshot() {
  // Force render before capture
  renderer.render(scene, camera)

  try {
    const dataURL = renderer.domElement.toDataURL("image/png")

    const confirmSave = confirm("Do you want to save this screenshot?")

    if (confirmSave) {
      const link = document.createElement("a")
      link.href = dataURL
      link.download = "ar-measurement.png"
      link.click()
    }

  } catch (err) {
    console.error("Screenshot failed:", err)
    alert("Screenshot not supported on this device.")
  }
}

const raycaster = new THREE.Raycaster()
const tap = new THREE.Vector2()

window.addEventListener("pointerdown", (event) => {
  tap.x = (event.clientX / window.innerWidth) * 2 - 1
  tap.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(tap, camera)

  const intersects = raycaster.intersectObjects(scene.children, true)

// 🔥 ONLY allow UI clicks
const uiHit = intersects.find(i => i.object.userData?.isUI)

if (uiHit) {
  let obj = uiHit.object

  while (obj) {
    if (obj.userData?.onClick) {
      obj.userData.onClick()
      return
    }
    obj = obj.parent
  }
}
})
// -------- UI --------


let arButtons = []
function createButton(text, position, onClick) {
    const size = 256
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  canvas.width = size
  canvas.height = size

  const center = size / 2
  const radius = size / 2 - 10

  // 🔥 Shadow (soft iOS look)
  ctx.shadowColor = "rgba(0,0,0,0.4)"
  ctx.shadowBlur = 20

  // 🔥 Circle background
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.fill()

  // 🔥 Border (optional subtle)
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(0,0,0,0.1)"
  ctx.stroke()

  // 🔥 Reset shadow for text
  ctx.shadowBlur = 0

  // 🔥 Text / icon
  ctx.fillStyle = "black"
  ctx.font = "bold 80px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, center, center)

  const texture = new THREE.CanvasTexture(canvas)

  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 64), // 🔥 round geometry
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
      
    })
  )
  

  mesh.position.copy(position)
  mesh.userData.onClick = onClick
  mesh.userData.isUI = true
  mesh.renderOrder = 999
  

  mesh.visible = false // 🔥 hidden by default

  camera.add(mesh)
  arButtons.push(mesh)

  return mesh
}

createButton("+", new THREE.Vector3(0, -0.2, -1), placePoint)
createButton("↺", new THREE.Vector3(-0.3, -0.2, -1), undo)
createButton("x", new THREE.Vector3(-0.6, -0.2, -1), clearAll)
createButton("✓", new THREE.Vector3(0.3, -0.2, -1), confirmMeasurement)

renderer.xr.addEventListener("sessionstart", () => {
  console.log("AR STARTED")

  arButtons.forEach(btn => btn.visible = true)
})

renderer.xr.addEventListener("sessionend", () => {
  console.log("AR ENDED")

  arButtons.forEach(btn => btn.visible = false)
})
function handleTap(event) {
  // center of screen tap (XR style)
  tap.x = 0
  tap.y = 0

  raycaster.setFromCamera(tap, camera)

  const intersects = raycaster.intersectObjects(scene.children, true)

  if (intersects.length > 0) {
    let obj = intersects[0].object

    while (obj) {
      if (obj.userData?.onClick) {
        obj.userData.onClick()
        return
      }
      obj = obj.parent
    }
  }
}

function smartSnap(pos) {
  for (let p of points) {
    const dx = Math.abs(p.position.x - pos.x)
    const dz = Math.abs(p.position.z - pos.z)

    if (dx < 0.05) pos.x = p.position.x
    if (dz < 0.05) pos.z = p.position.z
  }

  return pos
}

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.2, 32),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.2
  })
)

shadow.rotation.x = -Math.PI / 2
shadow.position.y = -0.49

scene.add(shadow)