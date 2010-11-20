(function () {
    var ui = glinamespace("gli.ui");

    var TextureInspector = function (w, elementRoot) {
        var self = this;
        this.window = w;
        this.elements = {
            toolbar: elementRoot.getElementsByClassName("texture-toolbar")[0],
            view: elementRoot.getElementsByClassName("texture-inspector")[0]
        };

        // Add toolbar widgets
        var faceDiv = document.createElement("div");
        faceDiv.className = "texture-faces";
        faceDiv.style.display = "none";
        var faceSpan = document.createElement("span");
        faceSpan.innerHTML = "Face: ";
        faceDiv.appendChild(faceSpan);
        var faceList = document.createElement("select");
        faceList.className = "";
        faceDiv.appendChild(faceList);
        var faceNames = ["POSITIVE_X", "NEGATIVE_X", "POSITIVE_Y", "NEGATIVE_Y", "POSITIVE_Z", "NEGATIVE_Z"];
        for (var n = 0; n < faceNames.length; n++) {
            var faceOption = document.createElement("option");
            faceOption.innerHTML = faceNames[n];
            faceList.appendChild(faceOption);
        }
        this.elements.toolbar.appendChild(faceDiv);
        this.elements.faces = faceDiv;
        this.faceList = faceList;
        faceList.onchange = function () {
            if (self.activeFace != faceList.selectedIndex) {
                self.activeFace = faceList.selectedIndex;
                self.updatePreview();
            }
        };

        var sizingDiv = document.createElement("div");
        sizingDiv.className = "texture-sizing";
        var nativeSize = document.createElement("span");
        nativeSize.title = "Native resolution (100%)";
        nativeSize.innerHTML = "100%";
        nativeSize.onclick = function () {
            self.sizingMode = "native";
            self.layout();
        };
        sizingDiv.appendChild(nativeSize);
        var sepSize = document.createElement("div");
        sepSize.className = "texture-sizing-sep";
        sepSize.innerHTML = " | ";
        sizingDiv.appendChild(sepSize);
        var fitSize = document.createElement("span");
        fitSize.title = "Fit to inspector window";
        fitSize.innerHTML = "Fit";
        fitSize.onclick = function () {
            self.sizingMode = "fit";
            self.layout();
        };
        sizingDiv.appendChild(fitSize);
        this.elements.toolbar.appendChild(sizingDiv);
        this.elements.sizingDiv = sizingDiv;

        var canvas = this.canvas = document.createElement("canvas");
        canvas.className = "gli-reset texture-inspector-canvas";
        canvas.style.display = "none";
        canvas.width = 1;
        canvas.height = 1;
        this.elements.view.appendChild(canvas);

        this.setupPreviewCanvas();

        this.sizingMode = "fit";
        this.resizeHACK = false;

        this.currentTexture = null;
        this.currentVersion = null;
        this.activeFace = 0;

        this.layout();
    };
    TextureInspector.prototype.setupPreviewCanvas = function () {
        var canvas = this.canvas;
        try {
            if (canvas.getContextRaw) {
                this.gl = canvas.getContextRaw("experimental-webgl");
            } else {
                this.gl = canvas.getContext("experimental-webgl");
            }
        } catch (e) {
            // ?
            alert("Unable to create texture preview canvas: " + e);
        }
        gli.hacks.installAll(this.gl);
        var gl = this.gl;

        var vsSource =
            'attribute vec2 a_position;' +
            'attribute vec2 a_uv;' +
            'varying vec2 v_uv;' +
            'void main() {' +
            '    gl_Position = vec4(a_position, 0.0, 1.0);' +
            '    v_uv = a_uv;' +
            '}';
        var fs2dSource =
            'precision highp float;' +
            'uniform sampler2D u_sampler0;' +
            'varying vec2 v_uv;' +
            'void main() {' +
            '    gl_FragColor = texture2D(u_sampler0, v_uv);' +
            '}';
        var fsCubeSource =
            'precision highp float;' +
            'uniform sampler2D u_sampler0;' +
            'uniform int u_face;' +
            'varying vec2 v_uv;' +
            'void main() {' +
            '    vec3 cuv = vec3(-(2 * v_uv.s), -(2 * v_uv.t), -1.0));' +
            '    gl_FragColor = textureCube(u_sampler0, cuv);' +
            '}';

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        // Initialize shaders
        var vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        var fs2d = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs2d, fs2dSource);
        gl.compileShader(fs2d);
        var fsCube = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fsCube, fsCubeSource);
        gl.compileShader(fsCube);
        var program2d = this.program2d = gl.createProgram();
        gl.attachShader(program2d, vs);
        gl.attachShader(program2d, fs2d);
        gl.linkProgram(program2d);
        gl.useProgram(program2d);
        var samplerUniform = gl.getUniformLocation(program2d, "u_sampler0");
        gl.uniform1i(samplerUniform, 0);
        var programCube = this.programCube = gl.createProgram();
        gl.attachShader(programCube, vs);
        gl.attachShader(programCube, fsCube);
        gl.linkProgram(programCube);
        gl.useProgram(programCube);
        var samplerUniform = gl.getUniformLocation(programCube, "u_sampler0");
        gl.uniform1i(samplerUniform, 0);

        var vertices = [
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1, 1, 0, 0,
            -1, 1, 0, 0,
             1, -1, 1, 1,
             1, 1, 1, 0
        ];
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        var positionAttr = gl.getAttribLocation(this.program2d, "a_position");
        gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 16, 0);
        var uvAttr = gl.getAttribLocation(this.program2d, "a_uv");
        gl.vertexAttribPointer(uvAttr, 2, gl.FLOAT, false, 16, 8);
    };
    TextureInspector.prototype.updatePreview = function () {
        var gl = this.gl;

        if (!this.currentTexture || !this.currentVersion) {
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return;
        }

        var targetFace;
        switch (this.currentTexture.type) {
            case gl.TEXTURE_2D:
                targetFace = null;
                break;
            case gl.TEXTURE_CUBE_MAP:
                targetFace = gl.TEXTURE_CUBE_MAP_POSITIVE_X + this.activeFace;
                break;
        }

        var size = this.currentTexture.guessSize(gl, this.currentVersion, targetFace);
        if (size) {
            this.canvas.width = size[0];
            this.canvas.height = size[1];
            this.canvas.style.display = "";
        } else {
            this.canvas.width = 1;
            this.canvas.height = 1;
            this.canvas.style.display = "none";
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        var gltex = this.currentTexture.createTarget(gl, this.currentVersion, targetFace);

        gl.activeTexture(gl.TEXTURE0);

        gl.useProgram(this.program2d);
        gl.bindTexture(gl.TEXTURE_2D, gltex);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        this.currentTexture.deleteTarget(gl, gltex);
    };
    TextureInspector.prototype.layout = function () {
        if (!this.currentTexture) {
            return;
        }

        var gl = this.window.context;
        var size = this.currentTexture.guessSize(gl);
        switch (this.sizingMode) {
            case "native":
                this.elements.view.scrollTop = 0;
                this.elements.view.scrollLeft = 0;
                this.canvas.style.left = "";
                this.canvas.style.top = "";
                this.canvas.style.width = "";
                this.canvas.style.height = "";
                break;
            case "fit":
                var parentWidth = this.elements.view.clientWidth;
                var parentHeight = this.elements.view.clientHeight;
                var parentar = parentHeight / parentWidth;
                var ar = size[1] / size[0];

                var width;
                var height;
                if (ar * parentWidth < parentHeight) {
                    width = parentWidth;
                    height = (ar * parentWidth);
                } else {
                    height = parentHeight;
                    width = (parentHeight / ar);
                }
                this.canvas.style.width = width + "px";
                this.canvas.style.height = height + "px";

                this.canvas.style.left = ((parentWidth / 2) - (width / 2)) + "px";
                this.canvas.style.top = ((parentHeight / 2) - (height / 2)) + "px";

                // HACK: force another layout because we may have changed scrollbar status
                if (this.resizeHACK) {
                    this.resizeHACK = false;
                } else {
                    this.resizeHACK = true;
                    this.layout();
                }
                break;
        }
    };
    TextureInspector.prototype.setTexture = function (texture, version) {
        var gl = this.window.context;

        this.currentTexture = texture;
        this.currentVersion = version;
        this.activeFace = 0;
        this.faceList.selectedIndex = 0;

        if (texture) {
            // Setup UI
            switch (texture.type) {
                case gl.TEXTURE_2D:
                    this.elements.faces.style.display = "none";
                    break;
                case gl.TEXTURE_CUBE_MAP:
                    this.elements.faces.style.display = "";
                    break;
            }
            this.updatePreview();
        } else {
            // Clear everything
            this.elements.faces.style.display = "none";
            this.canvas.width = 1;
            this.canvas.height = 1;
            this.canvas.style.display = "none";
        }

        this.layout();
    };

    var TextureView = function (w, elementRoot) {
        var self = this;
        this.window = w;
        this.elements = {
            view: elementRoot.getElementsByClassName("window-right")[0],
            listing: elementRoot.getElementsByClassName("texture-listing")[0]
        };

        this.inspector = new TextureInspector(w, elementRoot);

        this.currentTexture = null;
    };
    TextureView.prototype.layout = function () {
        this.inspector.layout();
    };

    function generateTextureDisplay(gl, el, texture) {
        var titleDiv = document.createElement("div");
        titleDiv.className = "info-title-master";
        titleDiv.innerHTML = texture.getName();
        el.appendChild(titleDiv);

        var repeatEnums = ["REPEAT", "CLAMP_TO_EDGE", "MIRROR_REPEAT"];
        var filterEnums = ["NEAREST", "LINEAR", "NEAREST_MIPMAP_NEAREST", "LINEAR_MIPMAP_NEAREST", "NEAREST_MIPMAP_LINEAR", "LINEAR_MIPMAP_LINEAR"];
        gli.ui.appendParameters(gl, el, texture, ["TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER"], [repeatEnums, repeatEnums, filterEnums, filterEnums]);
        gli.ui.appendbr(el);

        gli.ui.appendSeparator(el);

        var historyDiv = document.createElement("div");
        historyDiv.className = "info-title-secondary";
        historyDiv.innerHTML = "History";
        el.appendChild(historyDiv);

        var dummy = document.createElement("div");
        dummy.className = "texture-history";
        dummy.innerHTML = "upload history will go here<br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>...and probably be long";
        el.appendChild(dummy);
    };

    TextureView.prototype.setTexture = function (texture) {
        this.currentTexture = texture;

        this.elements.listing.innerHTML = "";
        if (texture) {
            generateTextureDisplay(this.window.context, this.elements.listing, texture);
        }

        var version = null;
        if (texture) {
            switch (this.window.activeVersion) {
                case null:
                    version = texture.currentVersion;
                    break;
                case "current":
                    var frame = this.window.controller.currentFrame;
                    if (frame) {
                        version = frame.findResourceVersion(texture);
                    }
                    version = version || texture.currentVersion; // Fallback to live
                    break;
            }
        }

        this.inspector.setTexture(texture, version);

        this.elements.listing.scrollTop = 0;
    };

    ui.TextureView = TextureView;
})();