export interface Source {
  name: string;
  type: string;
  path: string | string[];
}

export default [
  {
    name: 'globeTexture',
    type: 'texture',
    path: 'static/textures/earthspec1k.jpg',
  },
  {
    name: 'pointTexture',
    type: 'texture',
    path: 'static/textures/circle.png',
  },
];
