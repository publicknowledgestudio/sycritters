// Front silhouettes traced from the three supplied reference sprites.
export const CURATED_TEMPLATES = {
  brass: { rows: ['11111111','01111110','11111111','11111110','11111110','11111111','11111111','01010101'], gap: 1 },
  ember: { rows: ['00111100','01111110','11111111','11111111','11111111','11111111','01111110','00111100'], gap: 2 },
  minty: { rows: ['10111101','01111110','11111111','11111111','11111111','11111111','11111111','01100110'], gap: 2 },
};

// Hand-composed solids. Each creature has its own construction, not seed noise.
export const CURATED_CRITTERS = [
  { id: 'brass', name: 'Brass', eyeStyle: 'pixel', description: 'From your gold sprite: a stepped brow, an offset cheek, four little feet, and a ridged back.' },
  { id: 'ember', name: 'Ember', eyeStyle: 'pixel', description: 'From your orange sprite: a rounded pebble with a warm face, a broad flat back matching the rest of its body.' },
  { id: 'minty', name: 'Minty', eyeStyle: 'pixel', description: 'From your green sprite: a square little alien with corner ears, two broad feet, and a simple flat back.' },
  { id: 'loaf', name: 'Loaf', description: 'A broad, softly squared solid with a full rounded back.' },
  { id: 'barrel', name: 'Barrel', description: 'A chunky upright barrel with curved sides and broad flat ends.' },
  { id: 'wedge', name: 'Wedge', description: 'A big square face with a sloping back, like a solid doorstop.' },
  { id: 'boulder', name: 'Boulder', description: 'A heavy, lopsided pebble with broad shoulders and a rounded back.' },
  { id: 'pillar', name: 'Cross', description: 'A bold, solid cross with broad arms and a thick, flat back.' },
  { id: 'duo', name: 'Duo', description: 'Two large rounded lobes fused into one wide, solid body.' },
  { id: 'step', name: 'Step', description: 'A solid stepped block with a wide base and a raised upper tier.' },
  { id: 'cushion', name: 'Cushion', description: 'A broad pillow-shaped solid with gently bulging sides.' },
];
const ellipsoid = (x,y,z,cx,cy,cz,rx,ry,rz) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 + ((z-cz)/rz)**2 <= 1;
export function curatedVolume(id) {
  if (!CURATED_CRITTERS.some(critter => critter.id === id)) throw new Error(`Unknown curated critter: ${id}`);
  const masks = Array.from({length:8},()=>Array(8).fill(0));
  const grid = masks.map(row=>row.slice());
  const template = CURATED_TEMPLATES[id];
  const eyeRow = 3;
  for (let row=0;row<8;row++) for(let col=0;col<8;col++) for(let layer=0;layer<8;layer++) {
    const x=col-3.5, y=7.5-row, z=layer-5.5;
    let solid=false;
    if(template) {
      let depth;
      if(id==='brass') {
        depth=[4,5,6,7,7,7,6,3][row];
        if(row===0 && col%2===0) depth=6;
        if(row===7) depth=col%4===1 ? 7 : 4;
      } else if(id==='ember') {
        // Every slice shares the same outline, including the backmost layer.
        depth=6;
      } else {
        // Keep the body and feet flat; corner horns occupy only the front voxel.
        depth=row===0 && (col===0 || col===7) ? 1 : 5;
      }
      solid=template.rows[row][col]==='1' && layer>=8-depth;
    } else {
      const v=(y-4)/3.8, d=(z+1.7)/3.9;
      if(id==='loaf') {
        solid=(Math.abs(x/3.9)**4+Math.abs(v)**4+Math.abs(d)**4)<=1;
        if(layer===7 && (row===1 || row===6) && (col===1 || col===6)) solid=false;
      }
      if(id==='barrel') {
        const radius=3.9-.55*Math.abs(v)**3;
        solid=Math.abs(v)<1 && (x/radius)**2+((z+1.7)/radius)**2<=1;
      }
      if(id==='wedge') solid=Math.abs(x)<3.9-.2*Math.abs(v) && Math.abs(v)<1 && z>=-5.8+(y-.5)*.55;
      if(id==='boulder') solid=Math.abs((x-.35*v)/3.85)**2.8+Math.abs(v)**2.8+Math.abs((z+1.8+.3*v)/3.9)**2.8<=1;
      if(id==='pillar') solid=(Math.abs(x)<2 || Math.abs(y-4)<2.5) && z>=-3.5;
      if(id==='duo') solid=ellipsoid(x,y,z,-1.3,4,-1.7,2.65,3.8,3.9)||ellipsoid(x,y,z,1.3,4,-1.7,2.65,3.8,3.9);
      if(id==='step') {
        const half=y>5.5 ? 2.6 : 3.8;
        solid=Math.abs(x)<half && y>.5 && y<7.6 && Math.abs(z+1.7)<(y>5.5 ? 3.1 : 3.8);
        // Bevel the rear corners without adding fine features.
        if(Math.abs(x)>half-.7 && z< -4.5) solid=false;
      }
      if(id==='cushion') {
        solid=Math.abs(x/4.15)**4+Math.abs((y-4)/3.3)**4+Math.abs((z+1.7)/3.9)**4<=1;
        // Fill the four missing face pixels on each side.
        if((col===0 || col===7) && [1,2,5,6].includes(row) && layer>=6) solid=true;
      }
    }
    const rightEye = template?.gap === 1 ? 4 : 5;
    const eye = (row===eyeRow || row===eyeRow+1) && ((col>=1&&col<=2)||(col>=rightEye&&col<=rightEye+1));
    if(eye && layer>=5) solid=true;
    if(solid) masks[row][col] |= 1<<layer;
    grid[row][col] = eye ? 2 : Number(Boolean(masks[row][col]));
  }
  return {form:`curated:${id}`,grid,masks};
}
