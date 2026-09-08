export type Vec = [number, number, number];
export const add = (a: Vec, b: Vec): Vec => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a: Vec, b: Vec): Vec => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale = (a: Vec, s: number): Vec => [a[0]*s,a[1]*s,a[2]*s];
export const dot = (a: Vec,b: Vec) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a: Vec,b: Vec): Vec => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm = (a: Vec) => Math.hypot(...a);
export const unit = (a: Vec) => scale(a,1/norm(a));
export const distance = (a: Vec,b: Vec) => norm(sub(a,b));
export const rad = (n: number) => n*Math.PI/180;
export const wrap = (n: number) => ((n+180)%360+360)%360-180;
export function dihedral(a: Vec,b: Vec,c: Vec,d: Vec) {
  const axis = unit(sub(c,b)), u = sub(a,b), v = sub(d,c);
  const x = sub(u,scale(axis,dot(u,axis))), y = sub(v,scale(axis,dot(v,axis)));
  return Math.atan2(dot(cross(axis,x),y),dot(x,y))*180/Math.PI;
}
/** Internal-coordinate placement: length C–D, angle B–C–D, signed A–B–C–D torsion. */
export function place(a: Vec,b: Vec,c: Vec,length: number,angle: number,torsion: number): Vec {
  const axis = unit(sub(c,b)), ba = sub(a,b);
  const x = unit(sub(ba,scale(axis,dot(ba,axis)))), y = cross(axis,x);
  return add(c,scale(add(scale(axis,-Math.cos(rad(angle))),scale(add(scale(x,Math.cos(rad(torsion))),scale(y,Math.sin(rad(torsion)))),Math.sin(rad(angle)))),length));
}
export function rotate(p: Vec,origin: Vec,axis: Vec,degrees: number): Vec {
  const v=sub(p,origin),u=unit(axis),c=Math.cos(rad(degrees)),s=Math.sin(rad(degrees));
  return add(origin,add(add(scale(v,c),scale(cross(u,v),s)),scale(u,dot(u,v)*(1-c))));
}
