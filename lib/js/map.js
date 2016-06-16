// OpenLayers.ProxyHost = "/cgi-bin/proxy.cgi?url=";

var API_KN = 'http://dubrovsky.eu:3334/kn';

Ext.application({
    launch: function() {

    var mappanel = Ext.create('Ext.Panel', {
        region: "center",
        hideBorders: true,
        title: 'Katastr Downloader',
        stateful: true,
        stateId: 'mappanel',
        html: '<div id="map"></div>',
        tbar: [{
            id:"search",
            xtype: 'textfield',
            name: 'name',
            fieldLabel: 'Name',
            allowBlank: false,  // requires a non-empty value
            listeners: {
                specialkey: function(f,e){
                    if (e.getKey() == e.ENTER) {
                        geokoduj(this.value);
                    }
                }
            }

        },{
            text: "Hledat",
            handler: function() {
                geokoduj($("#search-inputEl").val());
            }
        }
        ]
    });

    var postup = '<div id="postup"><ul><li>1)Do vyhledávacího políčka v horní části obrazovky zadejce hledanou lokalitu.</li><li>1)Hledanou lokalitu je možné také najít postupným přibližováním mapy.</li><li>2)Nejsou li již vyplněny, tak kliknutím do mapy na požadovanou lokalitu se automaticky vyplní v záložce Export hodnoty katastrálního území.</li><li>3)Jsou li hodnoty vyplněny, je možné zvolit výstupní formát a souřadnicový systém pro exportovaná data</li><li>4)Tlačítkem export se spustí funkce na která po chvíly vrátí data ke stáhnutí. Stahovaná data jsou vždy omezena katastrálním územím požadované lokality.</li><li>5) Stáhnutý ZIP soubor obsahuje v závislosti na území jeden nebo tři datové soubory. Pokud je katastrální mapa dotazované lokality v digitální podobě (tenké linie, né ruční vyhotovení), tak ZIP archiv obsahuje vrstvu parcel (polygonová), vrstvu parcel (liniová) a vrstvu s jedním polygonem celého katastrálního území. Pokud je katastrální mapa v dotazované lokalitě analogová, bude ZIP archiv obsahovat pouze vrstvu jednoho polygonu katastrálního území.</li><li>6)Postup lze opakovat.</li><li></li><li>TIP vyexportujte data v souřadnicovém systému EPSG:4326 a ve formátu KML, vygenerované soubory lze prohlížet v digitálním globu Google Earth.</li></ul></div>'

    var item1 = Ext.create('Ext.Panel', {
        title: 'Export',
        html: '<div id="areainfo"></div>',
        cls:'empty'
    });

    var item2 = Ext.create('Ext.Panel', {
        title: 'Informace',
        html: '<div id="info">Služba využívá přístup k předgenerovaným datům KÚ poskytovaných ČUZK. </br>'+
        'Byly sledovány potíže s internetovým prohlížečem Internet Explorer.</br>'+
        'Data poskytované ČUZK jsou volně dostupná a stažitelná. </br>'+
        'Služba je zdarma, ale není garantovaná jak její funkčnost, tak dostupnost.</br>'+
        'Tento projekt je osobní iniciativou Vojtěcha Dubrovského. Není zaručena 100% funkčnost. Prosím o pochopení.</br>'+
        'Případné dotazy, díky a dary směřujte na <a href="mailto:v.dubr@hotmail.com">v.dubr@hotmail.com</a></br>'+
        '</div>',
        cls:'empty'
    });
    var item3 = Ext.create('Ext.Panel', {
        title: 'Postup',
        html: postup,
        cls:'empty'
    });


    /* {
        contentEl: "desc",
        region: "east",
        bodyStyle: {"padding": "5px"},
        collapsible: true,
        collapseMode: "mini",
        split: true,
        width: 200,
        title: "Description"
    }*/


    var accordion = Ext.create('Ext.Panel', {
        title: "Description",
        html: "desc",
        region: "west",

        collapsible: true,
        split: false,
        width: 400,
        layout:'accordion',
        items:[
        item1,item3,item2
        ]
    });

    Ext.create('Ext.container.Viewport', {
        layout: 'border',
        items: [
        mappanel,accordion
        ]
    });

    $('#areainfo').append($('<table/>',{
        style:"border:1px",
        id:"table"
    })
    .append($('<tr/>',{})
        .append($('<td/>',{}).append('Katastrální území:'))
        .append($('<td/>',{
            id:"nazevku"
        }).append("neidentifikováno")))

    .append($('<tr/>',{})
        .append($('<td/>',{}).append('Číslo katastrálního území:'))
        .append($('<td/>',{
            id:"ku"
        }).append("neidentifikováno")))

    .append($('<tr/>',{}).append(' '))

        .append($('<tr/>',{})
            .append($('<td/>',{}).append('Formát'))
            .append($('<td/>',{})
                .append($("<select/>",{
                    id:'format'
                })
                .append($("<option/>",{
                    value:"shp"
                }).append('Shapefile'))
                    .append($("<option/>",{
                        value:"kml"
                    }).append('KML'))
                    )))

        .append($('<tr/>',{})
            .append($('<td/>',{}).append('Souř sys'))
            .append($('<td/>',{})
                .append($("<select/>",{
                    id:'osrs'
                })
                .append($("<option/>",{
                    value:"4326"
                }).append('WGS84/EPSG:4326'))
                    .append($("<option/>",{
                        value:"5514"
                    }).append('JTSK/EPSG:102067(5514)'))
                    )))

        .append($('<tr/>',{})
            .append($('<td/>',{}).append($("<input/>",{
                id:"export",
                type:"button",
                value:"Exportovat"
            }))))

        .append($('<tr/>',{})
            .append($('<td/>',{}).append($("<img/>",{
                id:"status",
                src:"img/loader.gif",
                style:"display:none"
            }))))

        .append($('<tr/>',{})
            .append($('<td/>',{}).append($("<a/>",{
                id:"output",
                href:"",
                style:"display:none"
            }).append($("<img/>",{
                src:"img/zip_icon.png",
                width:"50px"
            })).append($("<p/>",{}).append("Stáhnout data"))
                )))


        ).append($('<div/>',{
        id:"infoDiv"
    }));

////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////START OF CODE//////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

    //pri nacteni bude vse disabled
    $("#table").find("input,button,textarea,select").attr("disabled", "disabled");

    //////////////////////////////odeslani pozadavku na API
    $("#export").click(function(){
      var knId = $("#ku").html()
      var srs = $("#osrs").val()
      var format = $("#format").val()
      var url = API_KN + "?id=" + knId + "&srs=" + srs + "&format=" + format;
      document.getElementById('download').src = url;
        return false;
    })

    var cleneniSource = new ol.source.ImageWMS({
      url: 'http://geoportal.cuzk.cz/WMS_SPH_PUB/WMService.aspx?',
      params: {
        FORMAT: 'image/png',
        LAYERS: 'GP_SPH_KU',
        STYLES: '_',
        TRANSPARENT: 'TRUE'
      }
    })

    var cleneniLayer = new ol.layer.Image({
      source: cleneniSource
    });

    var osm = new ol.layer.Tile({
      source: new ol.source.OSM()
    })

    var view = new ol.View({
      center: [1795352,6428048],
      zoom: 8,
      minZoom:7,
      maxZoom:18,
      extent: [1292959.08413812,6121961.9701148,2121705.28107187,6709371.69778512]
    })

    var map = new ol.Map({
       target: 'map',
       view: view,
      layers: [osm,cleneniLayer]
   });

    map.on('singleclick', function(evt) {
      callKNinfo(evt.coordinate);
    });


    var setPoint = function(coords) {
      if (!coords) {
        return
      }
      //clear
      SEARCHFEATURES.clear();
      var searchFeature = new ol.Feature({
        geometry: new ol.geom.Point(coords)
      })
      SEARCHFEATURES.push(searchFeature);
    }

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
          url: url,
          crossDomain: true,
          success: function(resp){
            var nazevKuXML = $(resp).find("Attribute").filter(function() {
                return $(this).attr('Name')=="NAZEV_KU";
            });

            var myXML = $(resp).find("Attribute").filter(function() {
                nazevKu = $(this).attr('Name')=="NAZEV_KU";
                return $(this).attr('Name')=="KOD_KU";

            });

            var nazevKu = nazevKuXML.text();
            var kuID = myXML.text()
            clearFormData();
            if (nazevKu && kuID) {
              setFormData(nazevKu, kuID);
            }
          }
      });
    }

    var clearFormData = function() {
      $("#table").find("input,button,textarea,select").attr("disabled", "disabled");
      $("#ku").html('');
      $("#nazevku").html('');
    }

    var setFormData = function(knTitle,kuID) {
      $("#table").find("input,button,textarea,select").removeAttr("disabled");
      $("#ku").html(kuID);
      $("#nazevku").html(knTitle);
    };

    var iconStyle = new ol.style.Style({
      image: new ol.style.Icon(
        ({
          anchor: [0.5, 1],
          size: [50,57],
          src: 'img/marker_mini.png'
        })
      )
    })
    var SEARCHFEATURES = new ol.Collection();
    var SEARCHOVERLAY = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: SEARCHFEATURES
      }),
      style: iconStyle
    });

    map.addLayer(SEARCHOVERLAY)

    window.map = map;

    var odpoved = function(resp) {
      var results = resp.getResults()[0].results;
      var firstResult = results[0];
      if (firstResult) {
        var coords = [firstResult.coords.x, firstResult.coords.y];
        var transformCoords = ol.proj.transform(coords,"EPSG:4326","EPSG:3857");
        //FIXME zoom to point then callKNinfo
        var zoomPoint = [transformCoords[0],transformCoords[1],transformCoords[0],transformCoords[1]];
        centerToExtent(zoomPoint, 400)
        setTimeout( function() {callKNinfo(transformCoords);}, 400)
      }
    }

    var geokoduj = function (query) {  /* Voláno při odeslání */
        new SMap.Geocoder(query, odpoved);
    }

    var centerToExtent = function(extent, boarder) {
      var mapSize = map.getSize();
      var innerBoarder = boarder;
      // var innerMapSize = [mapSize[0] - innerBoarder, mapSize[1] - innerBoarder];

      var projection = view.getProjection();
      var zoomExtent = extent;
      //if extent is point
      if (ol.extent.getHeight(extent) === 0 && ol.extent.getWidth(extent) === 0) {
        zoomExtent = extentBuffer(extent, projection, 4000);
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
  }
});
