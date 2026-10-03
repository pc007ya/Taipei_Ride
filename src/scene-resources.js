// Dispose unique owned GPU resources once, including inactive appearance models.
export function disposeGroups(groups){
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 for(const root of groups)root?.traverse?.(object=>{
  if(object.geometry)geometries.add(object.geometry);if(object.skeleton)skeletons.add(object.skeleton);
  for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);for(const uniform of Object.values(material.uniforms||{}))if(uniform?.value?.isTexture)textures.add(uniform.value);}
 });
 for(const resource of [...geometries,...materials,...textures,...skeletons])resource.dispose?.();
 return {geometries:geometries.size,materials:materials.size,textures:textures.size,skeletons:skeletons.size};
}
