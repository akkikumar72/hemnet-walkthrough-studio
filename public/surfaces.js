import * as THREE from "three";

// Deterministic, metre-scale procedural detail. No listing photos are modified.
export function surfaceMaterial(element, primitive) {
  const id = element.id;
  if (["canopy", "hedge"].includes(primitive.kind)) {
    return new THREE.MeshStandardMaterial({
      color: primitive.color,
      roughness: 0.88,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
  }
  const cloth =
    primitive.kind === "cushion" ||
    ["sofa", "bed", "rug"].includes(element.kind) ||
    /^(duvet|pillow|throw|curtain|towel|headboard|bed-base|round-rug)-/.test(
      id,
    );
  const color = new THREE.Color(primitive.color);
  const hsl = color.getHSL({});
  const timber =
    (element.kind === "floor" &&
      hsl.s > 0.12 &&
      !/^(garden|landscape)-/.test(id)) ||
    /^(deck-board|deck-rail)-/.test(id) ||
    (["table", "chair"].includes(element.kind) &&
      hsl.h < 0.14 &&
      hsl.s > 0.18 &&
      hsl.l < 0.7);
  const tile =
    (element.kind === "floor" && !timber && !/^(garden|landscape)-/.test(id)) ||
    id.startsWith("tile-wall-");
  const metal = /^(tap|basin-tap|shower-|towel-rail|coffee-leg|fridge)/.test(
    id,
  );
  const roof = id.startsWith("roof-");
  const solar = id.startsWith("roof-solar-panel-");
  const mirror = id.startsWith("mirror-face-");
  const botanical = cloth && id.includes("-botanical-");
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: mirror
      ? 0.035
      : solar
        ? 0.3
        : roof
          ? 0.48
          : cloth
            ? 0.93
            : timber
              ? 0.5
              : metal
                ? 0.26
                : tile
                  ? 0.65
                  : 0.78,
    metalness: mirror ? 1 : metal ? 0.65 : roof ? 0.18 : 0,
    transparent: primitive.glass,
    opacity: primitive.glass ? 0.12 : 1,
    depthWrite: !primitive.glass,
    sheen: cloth ? 0.35 : 0,
    sheenColor: cloth ? color.clone().multiplyScalar(0.65) : new THREE.Color(0),
    sheenRoughness: 0.85,
    clearcoat: timber ? 0.08 : 0,
    clearcoatRoughness: 0.55,
  });
  if (!cloth && !timber && !tile) return mat;
  const code = `
    varying vec3 surfaceWorld;
    varying vec3 surfaceNormal;
    float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float surfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+vec2(1,1)),f.x),f.y);}
    vec2 surfacePlane(){vec3 n=abs(surfaceNormal);return n.y>n.x&&n.y>n.z?surfaceWorld.xz:(n.x>n.z?surfaceWorld.zy:surfaceWorld.xy);}
  `;
  const parquet = timber && element.kind === "floor" && !id.startsWith("deck");
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 surfaceWorld; varying vec3 surfaceNormal;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nsurfaceWorld=(modelMatrix*vec4(transformed,1.)).xyz;surfaceNormal=normalize(mat3(modelMatrix)*normal);",
    );
    shader.fragmentShader = code + shader.fragmentShader;
    let detail;
    if (timber)
      detail = `
      vec2 wp=surfacePlane();
      ${parquet ? "vec2 block=floor(wp/.28); vec2 q=fract(wp/.28); if(mod(block.x+block.y,2.)>.5)q=q.yx; vec2 plank=vec2(floor(q.x*4.),0.)+block*7.; q=vec2(fract(q.x*4.),q.y);" : "vec2 plank=floor(wp/vec2(.14,2.1)); vec2 q=fract(wp/vec2(.14,2.1));"}
      float rand=surfaceHash(plank);
      float grain=surfaceNoise(vec2(q.x*38.+rand*12.,q.y*2.5));
      float fine=surfaceNoise(vec2(q.x*220.+rand*17.,q.y*8.));
      float edge=min(min(q.x,1.-q.x),min(q.y,1.-q.y));
      float seam=smoothstep(.002,.014+fwidth(edge),edge);
      diffuseColor.rgb*=mix(.77,1.10,rand)*(.91+.12*grain+.04*fine)*mix(.67,1.,seam);
    `;
    else if (cloth)
      detail = `
      vec2 wp=surfacePlane(); float nap=surfaceNoise(wp*150.); float weave=surfaceNoise(wp*650.);
      diffuseColor.rgb*=.88+.13*nap+.045*weave;
      ${
        botanical
          ? `
      vec2 cell=floor(wp/.12),q=fract(wp/.12)-.5;
      float seed=surfaceHash(cell),angle=seed*6.283;
      q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
      float radius=length(q),petal=.21+.075*cos(6.*atan(q.y,q.x));
      float flower=1.-smoothstep(petal-.012,petal+.012,radius);
      vec3 ink=mix(vec3(.12,.22,.24),vec3(.62,.69,.64),step(.48,seed));
      diffuseColor.rgb=mix(diffuseColor.rgb,ink,flower*.85);
      float center=1.-smoothstep(.028,.055,radius);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.24,.22),center);
      `
          : ""
      }
    `;
    else
      detail = `
      vec2 q=fract(surfacePlane()/.32);float edge=min(min(q.x,1.-q.x),min(q.y,1.-q.y));
      diffuseColor.rgb*=mix(.69,1.,smoothstep(.002,.012+fwidth(edge),edge));
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n" + detail,
    );
  };
  mat.customProgramCacheKey = () =>
    `surfaces-${cloth}-${botanical}-${timber}-${parquet}-${tile}`;
  return mat;
}
