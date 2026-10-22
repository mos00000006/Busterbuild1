// Render every saved combo slot; never reuse a single tile as the whole combo.
export function mountComboImage(image, product) {
  if(!image)return;
  const parent=image.parentElement;
  parent.querySelector('[data-hub-composition]')?.remove();
  const items=product._hubComboItems;
  image.hidden=false;image.style.removeProperty("display");
  if(!Array.isArray(items)||!items.length)return;
  image.hidden=true;image.style.setProperty("display","none","important");
  const stage=document.createElement('div');stage.dataset.hubComposition='';
  stage.setAttribute('role','img');stage.setAttribute('aria-label',product._name+' — all combo products');
  stage.style.cssText='position:relative;width:100%;max-width:650px;aspect-ratio:1.25;overflow:hidden;margin:auto;isolation:isolate;';
  const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
  for(const item of items){
    const x=number(item.x,0,100,0),y=number(item.y,0,100,0),width=number(item.width,1,100,25),height=number(item.height,1,100,25),rotation=number(item.rotation,0,359,0),scale=number(item.scale,.25,2,1);
    let url;try{url=new URL(item.image_url,'https://maliks-group-hub.moyanamoses006.workers.dev');if(url.origin!=='https://maliks-group-hub.moyanamoses006.workers.dev'||!url.pathname.startsWith('/api/public-price-tags/'))continue;}catch{continue;}
    const slot=document.createElement('div');slot.dataset.comboSlot=String(item.id);
    slot.style.cssText=`position:absolute;left:${x}%;top:${y}%;width:${width}%;height:${height}%;`;
    const rad=rotation*Math.PI/180,w=width*1.25,h=height;
    const fit=Math.min(w/(Math.abs(Math.cos(rad))*w+Math.abs(Math.sin(rad))*h),h/(Math.abs(Math.sin(rad))*w+Math.abs(Math.cos(rad))*h));
    const picture=document.createElement('img');picture.src=url.href;picture.alt=String(item.label||'Combo product');
    picture.style.cssText=`position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-height:0!important;object-fit:contain!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;transform:rotate(${rotation}deg) scale(${fit*scale})!important;transform-origin:center!important;`;
    slot.append(picture);stage.append(slot);
  }
  parent.append(stage);
}
