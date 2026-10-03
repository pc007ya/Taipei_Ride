// Weld only identical complete vertices. Hard normals, UV seams and vertex
// colors remain distinct, so indexing changes storage rather than the surface.
export function indexSampleGeometry(geometry) {
 if(geometry.index)return geometry;
 const attributes=Object.entries(geometry.attributes),keys=new Map(),indices=[],source=[];
 for(let i=0;i<geometry.attributes.position.count;i++){
  const key=attributes.flatMap(([,a])=>Array.from(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize))).join(',');
  let index=keys.get(key);
  if(index===undefined){index=source.length;keys.set(key,index);source.push(i);}
  indices.push(index);
 }
 for(const [name,a]of attributes){
  const values=new a.array.constructor(source.length*a.itemSize);
  source.forEach((i,j)=>values.set(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize),j*a.itemSize));
  const indexed=new a.constructor(values,a.itemSize,a.normalized);geometry.setAttribute(name,indexed);
 }
 geometry.setIndex(indices);return geometry;
}
