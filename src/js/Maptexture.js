const Maptexture = (lon, lat, zoom) => {
  let imgUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v9/static/${lon},${lat},${zoom},0,0/1024x512?access_token=pk.eyJ1IjoidmluaG50IiwiYSI6ImNqb2VqdXZvaDE4cnkzcG80dXkxZzlhNWcifQ.G6sZ1ukp_DhiSmCvgKblVQ`;
  return imgUrl;
};
export default Maptexture;
