"use strict"

window.onload = function() {
    
//Constant Objects (not used yet)
/*
var GAME = Object.freeze({
    width: 640,
    height: 360,
    fieldWidth: 400,
    fieldHeight: 200
});
var MATERIAL = Object.seal({
    groundMaterial: undefined,
    wallMaterial: undefined,
    bulletMaterial: undefined
});
*/

//Variables
var scene;
var camera;
var renderer;
var geometry;
var material;
var mesh;
    
var world;
var solver;
var physicsMaterial;
var sphereShape;
var sphereBody;
var bulletShape;
var bulletGeometry;
var shootDirection;
var shootVelocity = 30;
var bulletRadius = 0.1;
var walls = [];
var bullets = [];
var bulletMeshes = [];
var boxes = [];
var boxMeshes = [];

var controls = Date.now; 
var time = Date.now;

//HTML elements
var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');

//Set up pointerLock
var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
setupPointerLock();

//Start game
initCannon();
initScene();
render();

//Core functions
function initCannon() {
    //set up physics world
    world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;
    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;
    
    var solver = new CANNON.GSSolver();
    solver.iterations = 10;
    solver.tolerance = 0.1;
    
    var split = true;
    if(split)
        world.solver = new CANNON.SplitSolver(solver);
    else
        world.solver = solver;
    
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    
    //create physics material
    physicsMaterial = new CANNON.Material("slipperyMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
                                                            physicsMaterial,
                                                            0.0, // friction coefficient
                                                            0.3  // restitution
                                                            );
    world.addContactMaterial(physicsContactMaterial);
    
    //create player sphere
    var mass = 5;
    var radius = 1.3;
    sphereShape = new CANNON.Sphere(radius);
    sphereBody = new CANNON.Body({ mass: mass });
    sphereBody.addShape(sphereShape);
    sphereBody.position.set(0, 5, 0);
    sphereBody.linearDamping = 0.9;
    world.addBody(sphereBody);
    
    // Create a plane
    var groundShape = new CANNON.Plane();
    var groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
}
    
function initScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 0, 750);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    setupLights();
    setupFloor();
    setupWalls();
    setupControls();
    setupRenderer();

    window.addEventListener('resize', onWindowResize, false);
}
    
function render() {
    requestAnimationFrame(render);
    
    if (controls.enabled) {
        var dt = 1 / 60;
        world.step(dt);
        
        //update bullet positions
        for(var i = 0; i < bullets.length; i++){
            bulletMeshes[i].position.copy(bullets[i].position);
            bulletMeshes[i].quaternion.copy(bullets[i].quaternion);
        }
        
        //update box positions
        for(var i = 0; i < boxes.length; i++){
            boxMeshes[i].position.copy(boxes[i].position);
            boxMeshes[i].quaternion.copy(boxes[i].quaternion);
        }
    }
    
    controls.update(Date.now() - time);
    
    renderer.render(scene, camera);
    
    time = Date.now();
}

//Helper functions
function setupPointerLock() {
    if (havePointerLock) {
        //hook pointer lock state change events
        document.addEventListener('pointerlockchange', pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', pointerLockChange, false);

        document.addEventListener('pointerlockerror', pointerLockError, false);
        document.addEventListener('mozpointerlockerror', pointerLockError, false);
        document.addEventListener('webkitpointerlockerror', pointerLockError, false);
        
        //hook click
        instructions.addEventListener('click', onInstructionsClick, false);
    }
    else {
        instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
    }
}

function setupLights() {
    var light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(0.5, 1, 0.5);
    light.target.position.set(0, 0, 0);
    scene.add(light);
    
    var spotLight = new THREE.SpotLight(0x00ffff);
    spotLight.position.set(0, 30, 0);
    spotLight.castShadow = true;
    spotLight.shadowCameraNear = 20;
    spotLight.shadowCameraFar = 50;
    spotLight.shadowCameraFov = 40;
    spotLight.shadowMapBias = 0.1;
    spotLight.shadowMapDarkness = 0.7;
    spotLight.shadowMapWidth = 2*512;
    spotLight.shadowMapHeight = 2*512;
    scene.add(spotLight);
}

function setupFloor() {
    geometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
	geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    material = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

function setupWalls() {
    var halfExtents = new CANNON.Vec3(1, 1, 1);
    var boxShape = new CANNON.Box(halfExtents);
    var boxGeometry = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
    
    for(var i = 0; i < 20; i++) {
        var x = (Math.random() - 0.5) * 20;
        var y = 2;
        var z = (Math.random()  -0.5) * 20;
        
        var boxBody = new CANNON.Body({ mass: 1 });
        boxBody.addShape(boxShape);
        boxBody.position.set(x, y, z);
        world.addBody(boxBody);
        
        var boxMesh = new THREE.Mesh(boxGeometry, material);
        boxMesh.position.set(x, y, z);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        scene.add(boxMesh);
        
        boxes.push(boxBody);
        boxMeshes.push(boxMesh);
    }
}
    
function setupControls() {
    controls = new PointerLockControls(camera, sphereBody);
    scene.add(controls.getObject());
    window.addEventListener('click', onFire, false);
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xffffff);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    document.body.appendChild(renderer.domElement);
}

function getShootDirection(targetVector) {
    var vector = targetVector;
    targetVector.set(0, 0, 1);
    vector.unproject(camera);
    var ray = new THREE.Ray(sphereBody.position, vector.sub(sphereBody.position).normalize());
    targetVector.copy(ray.direction);
}
    
//Event listeners
function pointerLockChange(event) {
    console.log(event);
    
    var element = document.body;
    
    if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
        controls.enabled = true;

        blocker.style.display = 'none';
    } 
    else {
        controls.enabled = false;

        blocker.style.display = '-webkit-box';
        blocker.style.display = '-moz-box';
        blocker.style.display = 'box';

        instructions.style.display = '';
    }
}
    
function pointerLockError(event) {
    instructions.style.display = '';
}

function onInstructionsClick(event) {
    instructions.style.display = 'none';

    //Ask the browser to lock the pointer
    var element = document.body;
    element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

    if (/Firefox/i.test(navigator.userAgent)) {
        document.addEventListener('fullscreenchange', fullscreenChange, false);
        document.addEventListener('mozfullscreenchange', fullscreenChange, false);

        element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;
        element.requestFullscreen();
    } 
    else {
        element.requestPointerLock();
    }
}

function onFire(event) {
    if (controls.enabled) {
        //create bullet
        bulletShape = new CANNON.Sphere(bulletRadius);
        bulletGeometry = new THREE.SphereGeometry(bulletRadius, 32, 32);
        shootDirection = new THREE.Vector3();
        
        //get initial position
        var x = sphereBody.position.x;
        var y = sphereBody.position.y;
        var z = sphereBody.position.z;
        
        //add body
        var bulletBody = new CANNON.Body({ mass: 100 });
        bulletBody.addShape(bulletShape);
        world.addBody(bulletBody);
        bullets.push(bulletBody);
        
        //add mesh
        var bulletMesh = new THREE.Mesh(bulletGeometry, material);
        bulletMesh.castShadow = true;
        bulletMesh.receiveShadow = true;
        scene.add(bulletMesh);
        bulletMeshes.push(bulletMesh);
        
        //set velocity
        getShootDirection(shootDirection);
        bulletBody.velocity.set(  shootDirection.x * shootVelocity,
                                shootDirection.y * shootVelocity,
                                shootDirection.z * shootVelocity);
        
        //move the ball outside the player sphere
        x += shootDirection.x * (sphereShape.radius * 1.02 + bulletShape.radius);
        y += shootDirection.y * (sphereShape.radius * 1.02 + bulletShape.radius);
        z += shootDirection.z * (sphereShape.radius * 1.02 + bulletShape.radius);
        bulletBody.position.set(x, y, z);
        bulletMesh.position.set(x, y, z);
    }
}

function fullscreenChange(event) {
    if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {
        document.removeEventListener('fullscreenchange', fullscreenChange);
        document.removeEventListener('mozfullscreenchange', fullscreenChange);
        element.requestPointerLock();
    }
}
    
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
    
};//End onload function