const measurePipelineModule = () => {

let scene
let points = []
let activeObjects = []

const createLabel = (text, position) => {

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')

canvas.width = 256
canvas.height = 64

ctx.fillStyle = "rgba(0,0,0,0.6)"
ctx.fillRect(0,0,256,64)

ctx.fillStyle = "white"
ctx.font = "32px Arial"
ctx.textAlign = "center"
ctx.fillText(text,128,45)

const texture = new THREE.CanvasTexture(canvas)
const material = new THREE.SpriteMaterial({map:texture})

const sprite = new THREE.Sprite(material)
sprite.scale.set(0.2,0.05,1)
sprite.position.copy(position)

return sprite
}

const drawMeasurement = (p1,p2)=>{

const dist = p1.distanceTo(p2)

const lineGeo = new THREE.BufferGeometry().setFromPoints([p1,p2])
const line = new THREE.Line(
lineGeo,
new THREE.LineBasicMaterial({color:0xffffff})
)

scene.add(line)
activeObjects.push(line)

const mid = new THREE.Vector3().addVectors(p1,p2).multiplyScalar(0.5)

const label = createLabel(`${dist.toFixed(2)}m`,mid)
scene.add(label)
activeObjects.push(label)

}

const addPoint = ()=>{

const hitTest = XR8.XrController.hitTest(0.5,0.5,['FEATURE_POINT','ESTIMATED_SURFACE'])

if(hitTest.length>0){

const pos = hitTest[0].position

const point = new THREE.Vector3(pos.x,pos.y,pos.z)

const dot = new THREE.Mesh(
new THREE.SphereGeometry(0.015),
new THREE.MeshBasicMaterial({color:0x007AFF})
)

dot.position.copy(point)

scene.add(dot)

points.push(point)
activeObjects.push(dot)

if(points.length%2===0){

drawMeasurement(
points[points.length-2],
points[points.length-1]
)

}

}

}

return{

name:'measure-module',

onStart:()=>{

const xrScene = XR8.Threejs.xrScene()
scene = xrScene.scene

document.getElementById('add-btn').onclick = addPoint

document.getElementById('undo-btn').onclick = ()=>{

const obj = activeObjects.pop()
if(obj) scene.remove(obj)

}

document.getElementById('clear-btn').onclick = ()=>{

activeObjects.forEach(o=>scene.remove(o))
activeObjects=[]
points=[]

}

document.getElementById('back-btn').onclick = ()=>window.history.back()

}

}

}

XR8.addCameraPipelineModules([
XR8.GlTextureRenderer.pipelineModule(),
XR8.Threejs.pipelineModule(),
XR8.XrController.pipelineModule(),
measurePipelineModule()
])

XR8.run({
canvas:document.getElementById("camera-canvas")
})