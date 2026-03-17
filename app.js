let scene,camera,renderer
let controller
let hitTestSource=null
let hitTestSourceRequested=false

let points=[]
let objects=[]

scene=new THREE.Scene()

camera=new THREE.PerspectiveCamera(
70,
window.innerWidth/window.innerHeight,
0.01,
20
)

renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})
renderer.setSize(window.innerWidth,window.innerHeight)
renderer.xr.enabled=true

document.body.appendChild(renderer.domElement)

document.body.appendChild(
THREE.ARButton.createButton(renderer,{requiredFeatures:['hit-test']})
)

controller=renderer.xr.getController(0)
scene.add(controller)

function createDot(pos){

let dot=new THREE.Mesh(
new THREE.SphereGeometry(0.01),
new THREE.MeshBasicMaterial({color:0x007AFF})
)

dot.position.copy(pos)
scene.add(dot)

objects.push(dot)

}

function drawLine(p1,p2){

let geo=new THREE.BufferGeometry().setFromPoints([p1,p2])

let line=new THREE.Line(
geo,
new THREE.LineBasicMaterial({color:0xffffff})
)

scene.add(line)
objects.push(line)

let d=p1.distanceTo(p2)

document.getElementById("distance").innerText=
"Distance: "+d.toFixed(2)+" m"

}

function calculateArea(){

if(points.length<3) return

let area=0

for(let i=0;i<points.length;i++){

let j=(i+1)%points.length

area+=points[i].x*points[j].z
area-=points[j].x*points[i].z

}

area=Math.abs(area/2)

document.getElementById("area").innerText=
"Area: "+area.toFixed(2)+" m²"

}

document.getElementById("add").onclick=()=>{

let pos=new THREE.Vector3(0,0,-0.5)
pos.applyMatrix4(camera.matrixWorld)

points.push(pos)

createDot(pos)

if(points.length>1){

drawLine(
points[points.length-2],
points[points.length-1]
)

}

calculateArea()

}

document.getElementById("undo").onclick=()=>{

let obj=objects.pop()

if(obj) scene.remove(obj)

points.pop()

calculateArea()

}

document.getElementById("clear").onclick=()=>{

objects.forEach(o=>scene.remove(o))

objects=[]
points=[]

document.getElementById("distance").innerText="Distance: 0 m"
document.getElementById("area").innerText="Area: 0 m²"

}

renderer.setAnimationLoop(()=>{

renderer.render(scene,camera)

})