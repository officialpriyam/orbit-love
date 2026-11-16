export function drawOrbit(canvas: HTMLCanvasElement) {
  let animationId: number;
  const glContext = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
  });
  if (!glContext) {
    Object.assign(canvas.style, {
      width: "250px",
      height: "250px",
      border: "55px solid #e5a3b1",
      borderRadius: "50%",
      top: "100px",
      left: "15%",
      boxShadow: "inset 10px 10px 35px #fff,15px 20px 30px #b8657b55",
      transform: "rotateX(30deg) rotateY(-20deg)",
    });
    return;
  }
  const gl = glContext;
  const vertex = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const fragment = `precision highp float;uniform vec2 resolution;uniform float time;mat3 rx(float a){float s=sin(a),c=cos(a);return mat3(1,0,0,0,c,-s,0,s,c);}mat3 ry(float a){float s=sin(a),c=cos(a);return mat3(c,0,s,0,1,0,-s,0,c);}float torus(vec3 p,vec2 t){return length(vec2(length(p.xz)-t.x,p.y))-t.y;}vec2 scene(vec3 p){vec3 a=rx(.72)*ry(-.4+sin(time*.2)*.08)*(p-vec3(-.32,.23,0));vec3 b=rx(-.65)*ry(1.05)*(p-vec3(.36,-.25,.06));float x=torus(a,vec2(.72,.23));float y=torus(b,vec2(.70,.22));return x<y?vec2(x,0.):vec2(y,1.);}void main(){vec2 uv=(gl_FragCoord.xy*2.-resolution)/resolution.y;vec3 ro=vec3(0,0,4.),rd=normalize(vec3(uv,-3.1));float t=0.;vec2 hit;for(int i=0;i<90;i++){hit=scene(ro+rd*t);if(hit.x<.001||t>7.)break;t+=hit.x*.8;}if(t>7.){gl_FragColor=vec4(0);return;}vec3 p=ro+rd*t;vec2 e=vec2(.002,0);vec3 n=normalize(vec3(scene(p+e.xyy).x-scene(p-e.xyy).x,scene(p+e.yxy).x-scene(p-e.yxy).x,scene(p+e.yyx).x-scene(p-e.yyx).x));vec3 l=normalize(vec3(-2,4,4));float diffuse=max(dot(n,l),0.);float fres=pow(1.-max(dot(n,-rd),0.),2.);float spec=pow(max(dot(reflect(-l,n),-rd),0.),40.);vec3 base=mix(vec3(.79,.31,.43),vec3(.96,.73,.62),hit.y);vec3 irid=.10*cos(vec3(0,2,4)+dot(n,vec3(2,3,1))*2.5+hit.y);vec3 col=base*(.65+.35*diffuse)+irid+spec*.65+fres*.24;col=mix(col,vec3(1.,.93,.92),smoothstep(.55,.9,n.y)*.6);gl_FragColor=vec4(col,1.);}`;
  function shader(type: number, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error("Shader unavailable");
    return s;
  }
  try {
    const p = gl.createProgram()!;
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    gl.useProgram(p);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(p, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const res = gl.getUniformLocation(p, "resolution"),
      time = gl.getUniformLocation(p, "time");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function frame(t: number) {
      if (!canvas.isConnected) return;
      const d = Math.min(devicePixelRatio, 1.5);
      canvas.width = Math.round(canvas.clientWidth * d);
      canvas.height = Math.round(canvas.clientHeight * d);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(res, canvas.width, canvas.height);
      gl.uniform1f(time, t / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) animationId = requestAnimationFrame(frame);
    }
    frame(0);
    return () => {
      cancelAnimationFrame(animationId);
      gl.deleteBuffer(b);
      gl.deleteProgram(p);
    };
  } catch {
    canvas.style.display = "none";
  }
}
