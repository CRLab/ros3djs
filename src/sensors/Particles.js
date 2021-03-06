/**
 * @author David V. Lu!! - davidvlu@gmail.com
 */

/**
 * A set of particles. Used by PointCloud2.
 *
 * @constructor
 * @param options - object with following keys:
 *
 *  * tfClient - the TF client handle to use
 *  * texture - (optional) Image url for a texture to use for the points. Defaults to a single white pixel.
 *  * rootObject (optional) - the root object to add this marker to
 *  * size (optional) - size to draw each point (default 0.05)
 *  * max_pts (optional) - number of points to draw (default 100000)
 */
ROS3D.Particles = function(options) {
    options = options || {};
    this.tfClient = options.tfClient;
    var texture = options.texture || 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Pixel-white.png';
    var size = options.size || 0.05;
    this.max_pts = options.max_pts || 13000;
    this.first_size = null;
    this.prev_pts = 0;
    this.rootObject = options.rootObject || new THREE.Object3D();
    var that = this;
    THREE.Object3D.call(this);

    this.vertex_shader = [
        'attribute vec3 color;',
        'attribute float alpha;',
        'varying vec3 vColor;',
        'varying float falpha;',
        'void main() ',
        '{',
        '    vColor = color; // set color associated to vertex; use later in fragment shader',
        '    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
        '    falpha = alpha; ',
        '',
        '    // option (1): draw particles at constant size on screen',
        '    // gl_PointSize = size;',
        '    // option (2): scale particles as objects in 3D space',
        '    gl_PointSize = ', size, '* ( 300.0 / length( mvPosition.xyz ) );',
        '    gl_Position = projectionMatrix * mvPosition;',
        '}'
    ].join('\n');

    this.fragment_shader = [
        'uniform sampler2D texture;',
        'varying vec3 vColor; // colors associated to vertices; assigned by vertex shader',
        'varying float falpha;',
        'void main() ',
        '{',
        '    // THREE.Material.alphaTest is not evaluated for ShaderMaterial, so we',
        '    // have to take care of this ourselves.',
        '    if (falpha < 0.5) discard;',
        '    // calculates a color for the particle',
        '    gl_FragColor = vec4( vColor, 1.0 );',
        '    // sets particle texture to desired color',
        '    gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );',
        '}'
    ].join('\n');

    this.geom = new THREE.BufferGeometry();

    this.positions = new Array(3*this.max_pts);
    this.colors = new Array(3*this.max_pts);
    this.alpha = new Array(this.max_pts);

    for(var i=0; i < this.max_pts; i++){
        this.positions[3*i + 0] = Math.random() * 3 - 1.5;
        this.positions[3*i + 1] = Math.random() * 3 - 1.5;
        this.positions[3*i + 2] = Math.random() * 3 - 1.5;

        this.colors[3*i + 0] = 0xff;
        this.colors[3*i + 1] = 0xff;
        this.colors[3*i + 2] = 0xff;

        this.alpha[i] = 0.0;
    }

    var customUniforms =
        {
            texture:   { type: 't', value: new THREE.TextureLoader().load( texture ) },
        };

    this.shaderMaterial = new THREE.ShaderMaterial(
        {
            uniforms:          customUniforms,
            vertexShader:      this.vertex_shader,
            fragmentShader:    this.fragment_shader,
            transparent: true,
        });

    this.ps = new THREE.Points( this.geom, this.shaderMaterial );
    this.sn = null;

    this.geom.addAttribute( 'color', new THREE.Float32BufferAttribute( this.colors, 3 ).setDynamic( true )  );
    this.geom.addAttribute( 'alpha', new THREE.Float32BufferAttribute( this.alpha, 1 ) );
    this.geom.addAttribute( 'position', new THREE.Float32BufferAttribute( this.positions, 3 ).setDynamic( true )  );

    this.positions = this.geom.attributes.position.array;
    this.colors = this.geom.attributes.color.array;
    this.alpha = this.geom.attributes.alpha.array;

};

function setFrame(particles, frame)
{
    if(particles.sn===null){
        particles.sn = new ROS3D.SceneNode({
            frameID : frame,
            tfClient : particles.tfClient,
            object : particles.ps
        });

        particles.rootObject.add(particles.sn);
    }
}

function finishedUpdate(particles, n)
{
    if(particles.first_size === null){
        particles.first_size = n;
        particles.max_pts = Math.min(particles.max_pts, n);
    }

    for(var i=n; i<particles.prev_pts; i++){
        particles.alpha[i] = 0.0;
    }
    particles.prev_pts = n;

    particles.geom.attributes.position.needsUpdate = true;
    particles.geom.attributes.color.needsUpdate = true;
    particles.geom.attributes.alpha.needsUpdate = true;

    // if(n>particles.max_pts){
    //     console.error('Attempted to draw more points than max_pts allows');
    // }
}
