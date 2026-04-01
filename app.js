import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js'
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/webxr/ARButton.js'

const params = new URLSearchParams(location.search)
const productSize = "<?php echo $productSize; ?>"
const productImg  = "<?php echo $productImg; ?>"

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

// -------- CONFIG --------
let TILE_SIZE_CM = 60

if (productSize && productSize.includes("X")) {
  const parts = productSize.split("X").map(Number)
  TILE_SIZE_CM = parts[0]
} // change dynamically later
let scaleFactor = 1
let calibrationMode = true

// -------- THREE --------
let scene = new THREE.Scene()
let camera = new THREE.PerspectiveCamera()
let renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true })

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.xr.enabled = !isIOS
document.body.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1))

// -------- STATE --------
let points=[], lines=[], labels=[]
let tileMesh=null
let lastPos=null
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
    if(p.position.distanceTo(pos)<SNAP) return p.position.clone()
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
let calibPoints=[]

function placePoint(){
  let pos=new THREE.Vector3()

  if(!isIOS && reticle.visible){
    pos.setFromMatrixPosition(reticle.matrix)
  }else{
    camera.getWorldPosition(pos)
    pos.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.2))
    pos.y-=0.3
  }

  pos=snap(pos)
  lastPos=pos.clone()

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
  tex.repeat.set(1/sizeMeters,1/sizeMeters)

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
}
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

  if (intersects.length > 0) {
    let obj = intersects[0].object

    // climb parent chain if needed
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
function initUI() {
  console.log("UI initialized")
  console.log(document.getElementById("placeBtn"))

  const placeBtn = document.getElementById("placeBtn")
  const undoBtn = document.getElementById("undoBtn")
  const clearBtn = document.getElementById("clearBtn")
  const confirmBtn = document.getElementById("confirmBtn")
  const info = document.getElementById("info")

  document.addEventListener("click", () => {
  console.log("GLOBAL CLICK")
})

placeBtn.addEventListener("pointerdown", () => {
  console.log("POINTER DOWN placeBtn")
})

  if (!placeBtn || !undoBtn || !clearBtn || !confirmBtn || !info) {
    console.error("UI not found in DOM")
    console.log({ placeBtn, undoBtn, clearBtn, confirmBtn, info })
    return
  }

  window.info = info

  placeBtn.addEventListener("click", () => {
    console.log("PLUS clicked")
    placePoint()
  })

  undoBtn.addEventListener("click", undo)
  clearBtn.addEventListener("click", clearAll)
  confirmBtn.addEventListener("click", confirmMeasurement)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI)
} else {
  initUI()
}

function createButton(text, position, onClick) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  canvas.width = 256
  canvas.height = 128

  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = "black"
  ctx.font = "30px Arial"
  ctx.fillText(text, 50, 70)

  const texture = new THREE.CanvasTexture(canvas)

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.15),
    new THREE.MeshBasicMaterial({ map: texture })
  )

  camera.add(mesh)
  mesh.position.copy(position)
  mesh.userData.onClick = onClick
  

  scene.add(mesh)
}

createButton("+", new THREE.Vector3(0, -0.2, -1), placePoint)
createButton("Undo", new THREE.Vector3(0.4, -0.2, -1), undo)
createButton("Clear", new THREE.Vector3(0.8, -0.2, -1), clearAll)
createButton("Confirm", new THREE.Vector3(-0.4, -0.2, -1), confirmMeasurement)

