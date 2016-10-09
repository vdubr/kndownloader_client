//TODO
//
// 1) výraznější hranice ku
// 2) přidat patičku s about/návodem
// 3) zvážit použití vektorů pro ků
// 4) přidat export do dxf/dgn/sqlite
// 5) alert nad mapou, pokud je vyexportováno/uživatel se musí přiblížit když chce info o ku

//SERVER
//přidat sloupce jzm-popis (bude obsahovat ObjCode)
//server by v getu mohl vracet jen url, ze které by se potom stahovalo -> bylo by možné udělat loader

// var API_BASE = 'https://dubrovsky.eu/kndownloaderapi/';
var API_BASE = 'http://localhost:3000/';
var API_KN = API_BASE + 'kn';
var API_PROXY = API_BASE + 'proxy?';
var map;
var view;
var cleneniSource;

var onSearchSubmit = function(evt) {
  evt.preventDefault();
  var searchTherm = evt.currentTarget.search.value;
  geocede(searchTherm);
};

var searchForm = document.getElementById('search');
searchForm.addEventListener('submit', onSearchSubmit, false);

$('#export').click(function(evt) {
  evt.preventDefault();

  var knId = $('#ku').html();
  var srs = $('#osrs').val();
  var format = $('#format').val();
  //add for support single files
  //+ '&types=parcel'
  var url = API_KN + '?id=' + knId + '&srs=' + srs + '&format=' + format;
  downloadURL(url);
});

var downloadURL = function downloadURL(url) {
  var hiddenIFrameID = 'hiddenDownloader';
  var iframe = document.getElementById(hiddenIFrameID);
  if (iframe === null) {
    iframe = document.createElement('iframe');
    iframe.id = hiddenIFrameID;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  };
  iframe.src = url;
};

var setPoint = function(coords) {
  if (!coords) {
    return;
  }
  //clear
  SEARCHFEATURES.clear();
  var searchFeature = new ol.Feature({
    geometry: new ol.geom.Point(coords)
  });
  SEARCHFEATURES.push(searchFeature);
};

var callKNinfo = function(coords) {
  setPoint(coords);

  var viewResolution = view.getResolution();
  var url = cleneniSource.getGetFeatureInfoUrl(
      coords, viewResolution, 'EPSG:3857',
      {'INFO_FORMAT': 'text/xml'}
  );

  $.ajax({
    type: 'GET',
    // url: url.replace('http', 'https'),
    url: API_PROXY + url,
    crossDomain: true,
    success: function(resp) {
        var nazevKuXML = $(resp).find('Attribute').filter(function() {
          return $(this).attr('Name') == 'NAZEV_KU';
        });

        var myXML = $(resp).find('Attribute').filter(function() {
          nazevKu = $(this).attr('Name') == 'NAZEV_KU';
          return $(this).attr('Name') == 'KOD_KU';

        });

        var nazevKu = nazevKuXML.text();
        var kuID = myXML.text();
        clearFormData();
        if (nazevKu && kuID) {
          setFormData(nazevKu, kuID);
        }
      }
  });
};

var clearFormData = function() {
  $('#table').find('input,button,textarea,select').attr('disabled', 'disabled');
  $('#ku').html('');
  $('#nazevku').html('');
};

var setFormData = function(knTitle, kuID) {
  $('.leftWrapper').find('input,button,textarea,select').removeAttr('disabled');
  $('#ku').html(kuID);
  $('#nazevku').html(knTitle);
};

//setmap

var setMap = function() {
  cleneniSource = new ol.source.ImageWMS({
    url: 'http://geoportal.cuzk.cz/WMS_SPH_PUB/WMService.aspx?',
    params: {
      FORMAT: 'image/png',
      LAYERS: 'GP_SPH_KU',
      STYLES: '_',
      TRANSPARENT: 'TRUE'
    }
  });

  var cleneniLayer = new ol.layer.Image({
    source: cleneniSource
  });

  var osm = new ol.layer.Tile({
    source: new ol.source.OSM()
  });

  view = new ol.View({
    center: [1795352,6428048],
    zoom: 8,
    minZoom: 7,
    maxZoom: 18,
    extent: [1292959.08413812,6121961.9701148,2121705.28107187,6709371.69778512]
  });

  map = new ol.Map({
    target: 'map',
    view: view,
    layers: [osm, cleneniLayer]
  });

  map.on('singleclick', function(evt) {
    //FIXME check zoom
    callKNinfo(evt.coordinate);
  });

  var iconStyle = new ol.style.Style({
    image: new ol.style.Icon(
      ({
        anchor: [0.5, 1],
        size: [50,57],
        src: 'img/marker_mini.png'
      })
    )
  });
  SEARCHFEATURES = new ol.Collection();
  var SEARCHOVERLAY = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: SEARCHFEATURES
    }),
    style: iconStyle
  });

  map.addLayer(SEARCHOVERLAY);

};
setMap();

var odpoved = function(resp) {
  var results = resp.getResults()[0].results;
  var firstResult = results[0];
  if (firstResult) {
    var coords = [firstResult.coords.x, firstResult.coords.y];
    var transformCoords = ol.proj.transform(coords,'EPSG:4326','EPSG:3857');
    var zoomPoint = [transformCoords[0],transformCoords[1],transformCoords[0],transformCoords[1]];
    centerToExtent(zoomPoint);
    //because get feature info on kn works from this zoom
    if (map.getView().getZoom() < 13) {
      map.getView().setZoom(13);
    }
    setTimeout(function() {callKNinfo(transformCoords);}, 400);
  }
};

var geocede = function(query) {  /* Voláno při odeslání */
  new SMap.Geocoder(query, odpoved);
};

var centerToExtent = function(extent) {
  var mapSize = map.getSize();

  var projection = view.getProjection();
  var zoomExtent = extent;
  //if extent is point
  if (ol.extent.getHeight(extent) === 0 && ol.extent.getWidth(extent) === 0) {
    zoomExtent = extentBuffer(extent, projection, 2000);
  }

  var pan = ol.animation.pan({
    source: view.getCenter(),
    duration: 200
  });

  var zoom = ol.animation.zoom({
    resolution: view.getResolution(),
    duration: 200
  });
  map.beforeRender(pan, zoom);
  view.fit(zoomExtent, mapSize);
};

var extentBuffer = function(extent, projection, value) {
  var unit = projection.getUnits();
  if (unit === 'degrees') {
    value = value / projection.getMetersPerUnit();
  }
  var zoomExtent = ol.extent.buffer(extent, value);
  return zoomExtent;
};
