function layerModel(options, parent) {
    var self = this,
        $descriptionTemp;

    // properties
    self.id = options.id || null;
    self.name = options.name || null;
    self.url = options.url || null;
    self.arcgislayers = options.arcgis_layers || 0;
    self.type = options.type || null;
    self.utfurl = options.utfurl || false;
    self.legend = options.legend || false;
    self.learn_link = options.learn_link || null;
    self.legendVisibility = ko.observable(false);
    self.legendTitle = options.legend_title || false;
    self.legendSubTitle = options.legend_subtitle || false;
    self.themes = ko.observableArray();
    //self.attributeTitle = options.attributes ? options.attributes.title : self.name;
    self.attributes = options.attributes ? options.attributes.attributes : [];
    self.compress_attributes = options.attributes ? options.attributes.compress_attributes : false;
    self.attributeEvent = options.attributes ? options.attributes.event : [];
    self.lookupField = options.lookups ? options.lookups.field : null;
    self.lookupDetails = options.lookups ? options.lookups.details : [];
    self.color = options.color || "#ee9900";
    self.fillOpacity = options.fill_opacity || 0.0;
    self.defaultOpacity = options.opacity || 0.5;
    self.opacity = ko.observable(self.defaultOpacity);
    self.graphic = options.graphic || null;

    // set target blank for all links
    if (options.description) {
        $descriptionTemp = $("<div/>", {
            html: options.description
        });
        $descriptionTemp.find('a').each(function() {
            $(this).attr('target', '_blank');
        });
        self.description = $descriptionTemp.html();
    } else {
        self.description = null;
    }
    
    // set overview text for Learn More option
    if (options.overview) {
        self.overview = options.overview;
    } else if (parent && parent.overview) {
        self.overview = parent.overview;
    } else if (self.description) {
        self.overview = self.description;
    } else if (parent && parent.description) {
        self.overview = parent.description;
    } else {
        self.overview = null;
    }
    
    // set data source and data notes text 
    self.data_source = options.data_source || null;
    if (! self.data_source && parent && parent.data_source) {
        self.data_source = parent.data_source;
    } 
    self.data_notes = options.data_notes || null;
    if (! self.data_notes && parent && parent.data_notes) {
        self.data_notes = parent.data_notes;
    } 
    
    // set download links 
    self.kml = options.kml || null;
    self.data_download = options.data_download || null;
    self.metadata = options.metadata || null;
    self.source = options.source || null;

    // opacity
    self.opacity.subscribe(function(newOpacity) {
        if (self.layer.CLASS_NAME === "OpenLayers.Layer.Vector") {
            self.layer.styleMap.styles['default'].defaultStyle.strokeOpacity = newOpacity;
            self.layer.styleMap.styles['default'].defaultStyle.graphicOpacity = newOpacity;
            //fill is currently turned off for many of the vector layers
            //the following line has the effect of overriding the zeroed out fill opacity (which we don't want)
            //self.layer.styleMap.styles['default'].defaultStyle.fillOpacity = newOpacity;
            self.layer.redraw();
        } else {
            self.layer.setOpacity(newOpacity);
        }
    });

    // is description active
    self.infoActive = ko.observable(false);
    app.viewModel.showOverview.subscribe( function() {
        if ( app.viewModel.showOverview() === false ) {
            self.infoActive(false);
        }
    });
    
    // is the layer a checkbox layer
    self.isCheckBoxLayer = ko.observable(false);
    if (self.type === 'checkbox') {
        self.isCheckBoxLayer(true);
    }
    
    // is the layer in the active panel?
    self.active = ko.observable(false);
    // is the layer visible?
    self.visible = ko.observable(false);       

    self.activeSublayer = ko.observable(false);
    self.visibleSublayer = ko.observable(false);

    self.subLayers = [];

    // save a ref to the parent, if it exists
    if (parent) {
        self.parent = parent;
        self.fullName = self.parent.name + " (" + self.name + ")";
        if ( ! self.legendTitle ) {
            self.legendTitle = self.parent.legendTitle;
        }
        if ( ! self.legendSubTitle ) {
            self.legendSubTitle = self.parent.legendSubTitle;
        }
    } else {
        self.fullName = self.name;
    }


    self.toggleLegendVisibility = function() {
        var layer = this;
        layer.legendVisibility(!layer.legendVisibility());
    };
    
    self.hasVisibleSublayers = function() {
        if ( !self.subLayers ) {
            return false;
        }
        var visibleSubLayers = false;
        $.each(self.subLayers, function(i, sublayer) {
            if (sublayer.visible()) {
                visibleSubLayers = true;
            }
        });
        return visibleSubLayers;
    };

    self.deactivateLayer = function() {
        var layer = this;
        // remove from active layers
        app.viewModel.activeLayers.remove(layer);

        //remove related utfgrid layer
        if (layer.utfgrid) { //NEED TO CHECK FOR PARENT LAYER HERE TOO...
            //the following removes this layers utfgrid from the utfcontrol and prevents continued utf attribution on this layer
            app.map.UTFControl.layers.splice($.inArray(this.utfgrid, app.map.UTFControl.layers), 1);
            //var control = $.inArray(this.utfgrid, app.map.UTFControl.layers);
            //app.map.removeControl(
            app.map.removeLayer(this.utfgrid);
        }
        
        //remove the key/value pair from aggregatedAttributes
        //debugger;
        app.viewModel.removeFromAggregatedAttributes(layer.name);
        //delete app.viewModel.aggregatedAttributes()[layer.name];
        //app.viewModel.updateAggregatedAttributes
        //debugger;
        
        layer.active(false);
        layer.visible(false);

        app.setLayerVisibility(layer, false);
        layer.opacity(layer.defaultOpacity);
        
        //layer.layer = null;

        if (layer.parent && layer.parent.isCheckBoxLayer()) { // if layer has a parent and that layer is a checkbox layer
            // see if there are any remaining active sublayers in this checkbox layer
            var stillActive = false;
            $.each(layer.parent.subLayers, function(i, sublayer) {
                if ( sublayer.active() ) {
                    stillActive = true;
                }
            });
            // if there are no remaining active sublayers, then deactivate parent layer
            if (!stillActive) {
                layer.parent.active(false);
                layer.parent.activeSublayer(false);
                layer.parent.visible(false);
                layer.parent.visibleSublayer(false);
            }
            //check to see if any sublayers are still visible 
            if (!layer.parent.hasVisibleSublayers()) {
                layer.parent.visible(false);
            }
        } else if (layer.parent) { // if layer has a parent
            // turn off the parent shell layer
            layer.parent.active(false);
            layer.parent.activeSublayer(false);
            layer.parent.visible(false);
            layer.parent.visibleSublayer(false);
        } 
        
        if (layer.activeSublayer()) {
            if ($.inArray(layer.activeSublayer().layer, app.map.layers) !== -1) {
                app.map.removeLayer(layer.activeSublayer().layer);
            }
            layer.activeSublayer().deactivateLayer();
            layer.activeSublayer(false);
            layer.visibleSublayer(false);
        } 
        if ($.inArray(layer.layer, app.map.layers) !== -1) {
            app.map.removeLayer(layer.layer);
        }
        layer.layer = null;

    };

    self.activateLayer = function() {
        var layer = this;

        if (!layer.active() && layer.type !== 'placeholder') {
        
            app.addLayerToMap(layer);

            //changed the following so that 
            //if the layer is an attributed vector layer, it will be added to the top of activeLayers
            //otherwise, it will be added just before the first non-vector layer
            /*
            if (layer.type === "Vector" && layer.attributes.length) {
                // add it to the top of the active layers
                app.viewModel.activeLayers.unshift(layer);
            } else {
                var index = 0;
                $.each(app.viewModel.activeLayers(), function(i, layer) {
                    if (!(layer.type === "Vector" && layer.attributes.length)) {
                        return false;
                    } else {
                        index += 1;
                    }
                });
                app.viewModel.activeLayers.splice(index, 0, layer);
            }
            */
            //now that we now longer use the selectfeature control we can simply do the following 
            app.viewModel.activeLayers.unshift(layer);

            // set the active flag
            layer.active(true);
            layer.visible(true);

            // save reference in parent layer
            if (layer.parent) {
                if (layer.parent.type === 'radio' && layer.parent.activeSublayer()) {
                    // only allow one sublayer on at a time
                    layer.parent.activeSublayer().deactivateLayer();
                }
                layer.parent.active(true);
                layer.parent.activeSublayer(layer);
                layer.parent.visible(true);
                layer.parent.visibleSublayer(layer);
            }

            //add utfgrid if applicable
            if (layer.utfgrid) {
                app.map.UTFControl.layers.unshift(layer.utfgrid);
            }

        }
    };

    // bound to click handler for layer visibility switching in Active panel
    self.toggleVisible = function() {
        var layer = this;
        
        if (layer.visible()) { //make invisible
            self.setInvisible(layer);
        } else { //make visible
            self.setVisible(layer);
        }
    };
    
    self.setVisible = function() {
        var layer = this;
        
        layer.visible(true);
        if (layer.parent) {
            layer.parent.visible(true);
        }
        app.setLayerVisibility(layer, true);

        //add utfgrid if applicable
        if (layer.utfgrid) {
            app.map.UTFControl.layers.splice($.inArray(this, app.viewModel.activeLayers()), 0, layer.utfgrid);
        }
    }
    
    self.setInvisible = function() {
        var layer = this;
        
        layer.visible(false);
        if (layer.parent) {
            // if layer.parent is not a checkbox, set parent to invisible
            if (layer.parent.type !== 'checkbox') {
                layer.parent.visible(false);
            } else { //otherwise layer.parent is checkbox 
                //check to see if any sublayers are still visible 
                if (!layer.parent.hasVisibleSublayers()) {
                    layer.parent.visible(false);
                }
            }
        }
        app.setLayerVisibility(layer, false);
        
        app.viewModel.removeFromAggregatedAttributes(layer.name);
        
        if ($.isEmptyObject(app.viewModel.visibleLayers())) {
            app.viewModel.closeAttribution();
        }

        //remove related utfgrid layer
        if (layer.utfgrid) {
            //the following removes this layers utfgrid from the utfcontrol and prevents continued utf attribution on this layer
            app.map.UTFControl.layers.splice($.inArray(this.utfgrid, app.map.UTFControl.layers), 1);
        }
    }

    self.showSublayers = ko.observable(false);

    self.showSublayers.subscribe(function () {
        setTimeout(function () {
            $('.layer').find('.open .layer-menu').jScrollPane();
        });
    });

    // bound to click handler for layer switching
    self.toggleActive = function(self, event) {
        var layer = this;

        //handle possible dropdown/sublayer behavior
        if (layer.subLayers.length) {
            if (!layer.activeSublayer()) { //if layer does not have an active sublayer, then show/hide drop down menu
                if (!layer.showSublayers()) {
                    //show drop-down menu
                    layer.showSublayers(true);
                } else {
                    //hide drop-down menu
                    layer.showSublayers(false);
                }
            } else if ( layer.type === 'checkbox' ) { //else if layer does have an active sublayer and it's checkbox (not radio) 
                if (!layer.showSublayers()) {
                    //show drop-down menu
                    layer.showSublayers(true);
                } else {
                    //hide drop-down menu
                    layer.showSublayers(false);
                }
            } else {
                //turn off layer
                layer.deactivateLayer();
                layer.showSublayers(false);
            }
            return;
        }

        // start saving restore state again and remove restore state message from map view
        app.saveStateMode = true;
        app.viewModel.error(null);

        // save a ref to the active layer for editing,etc
        // still using this?
        app.viewModel.activeLayer(layer);

        if (layer.active()) { // if layer is active
            layer.deactivateLayer();
        } else { // otherwise layer is not currently active
            layer.activateLayer();
        }
    };
    

    self.raiseLayer = function(layer, event) {
        var current = app.viewModel.activeLayers.indexOf(layer);
        if (current === 0) {
            // already at top
            return;
        }
        $(event.target).closest('tr').fadeOut('fast', function() {
            app.viewModel.activeLayers.remove(layer);
            app.viewModel.activeLayers.splice(current - 1, 0, layer);
        });
    };

    self.lowerLayer = function(layer, event) {
        var current = app.viewModel.activeLayers.indexOf(layer);
        if (current === app.viewModel.activeLayers().length) {
            // already at top
            return;
        }
        $(event.target).closest('tr').fadeOut('fast', function() {
            app.viewModel.activeLayers.remove(layer);
            app.viewModel.activeLayers.splice(current + 1, 0, layer);
        });
    };

    self.isTopLayer = function(layer) {
        return app.viewModel.activeLayers.indexOf(layer) === 0;
    };

    self.isBottomLayer = function(layer) {
        return app.viewModel.activeLayers.indexOf(layer) === app.viewModel.activeLayers().length - 1;
    };
    
    self.toggleSublayerDescription = function(layer) {
        if ( ! self.infoActive() ) {
            self.showSublayerDescription(self);
        } else if (layer === app.viewModel.activeInfoSublayer()) {
        } else {
            self.showDescription(self);
        }
    };
    
    self.showSublayerDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(layer);
        layer.infoActive(true);
        layer.parent.infoActive(true);
        app.viewModel.showOverview(true);
        app.viewModel.updateCustomScrollbar('#overview-overlay-text');
        //app.viewModel.updateDropdownScrollbar('#overview-overlay-dropdown');
        app.viewModel.hideMapAttribution();
    };
    
    // display descriptive text below the map
    self.toggleDescription = function(layer) {
        if ( ! layer.infoActive() ) {
            self.showDescription(layer);
        } else {
            self.hideDescription(layer);
        }
    };
    
    self.showDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(false);
        app.viewModel.activeInfoLayer(layer);
        self.infoActive(true);
        if (layer.subLayers.length > 0) {
            $('#overview-overlay').height(195);
        } else {
            $('#overview-overlay').height(186);
        }
        app.viewModel.showOverview(true);
        app.viewModel.updateCustomScrollbar('#overview-overlay-text');
        //app.viewModel.updateDropdownScrollbar('#overview-overlay-dropdown');
        app.viewModel.hideMapAttribution();
    };
    
    self.hideDescription = function(layer) {
        app.viewModel.showOverview(false);
        app.viewModel.activeInfoSublayer(false);
        app.viewModel.showMapAttribution();
    };
    
    self.toggleDescriptionMenu = function(layer) {
        //console.dir(layer);
    };
    
    
    self.showTooltip = function(layer, event) {
        var layerActual;
        $('#layer-popover').hide();
        if (layer.activeSublayer() && layer.activeSublayer().description) {
            layerActual = layer.activeSublayer();
        } else {
            layerActual = layer;
        }
        if (layerActual.description) {
            app.viewModel.layerToolTipText(layerActual.description);
            $('#layer-popover').show().position({
                "my": "right middle",
                "at": "left middle",
                "of": $(event.target).closest(".btn-group")
            });
        }
    };

    // remove the layer dropdrown menu
    self.closeMenu = function(layer, event) {
        $(event.target).closest('.btn-group').removeClass('open');
        layer.showSublayers(false);
    };

    return self;
} // end layerModel

function themeModel(options) {
    var self = this;
    self.name = options.display_name;
    self.id = options.id;
    self.description = options.description;
    self.learn_link = options.learn_link;

    // array of layers
    self.layers = ko.observableArray();

    //add to open themes
    self.setOpenTheme = function() {
        var theme = this;
        
        // ensure data tab is activated
        $('#dataTab').tab('show');

        if (self.isOpenTheme(theme)) {
            //app.viewModel.activeTheme(null);
            app.viewModel.openThemes.remove(theme);
            app.viewModel.updateScrollBars();
        } else {
            app.viewModel.openThemes.push(theme);
            //setTimeout( app.viewModel.updateScrollBar(), 1000);
            app.viewModel.updateScrollBars();
        }
    };
    
    //is in openThemes
    self.isOpenTheme = function() {
        var theme = this;
        if (app.viewModel.openThemes.indexOf(theme) !== -1) {
            return true;
        }
        return false;
    };

    //display theme text below the map
    self.setActiveTheme = function() {
        var theme = this;
        app.viewModel.activeTheme(theme);
        app.viewModel.activeThemeName(self.name);
        app.viewModel.themeText(theme.description);
    };

    // is active theme
    self.isActiveTheme = function() {
        var theme = this;
        if (app.viewModel.activeTheme() == theme) {
            return true;
        }
        return false;
    };

    self.hideTooltip = function(theme, event) {
        $('.layer-popover').hide();
    };

    return self;
} // end of themeModel

function bookmarkModel($popover) {
    var self = this;

    // name of the bookmark
    self.bookmarkName = ko.observable();

    // list of bookmarks
    self.bookmarksList = ko.observableArray();

    // load state from bookmark
    self.loadBookmark = function(bookmark) {
        app.saveStateMode = false;
        app.loadState(bookmark.state);

        app.viewModel.activeBookmark(bookmark.name);

        // show the alert for resting state
        app.viewModel.error("restoreState");
        $('#bookmark-popover').hide();
    };
    
    self.restoreState = function() {
        // hide the error
        app.viewModel.error(null);
        // restore the state
        app.loadState(app.restoreState);
        app.saveStateMode = true;
    };

    self.removeBookmark = function(bookmark) {
        
        //if the user is logged in, ajax call to add bookmark to server 
        if (app.is_authenticated) { 
            $.ajax({ 
                url: '/visualize/remove_bookmark', 
                data: { name: bookmark.name, hash: $.param(bookmark.state) }, 
                type: 'POST',
                dataType: 'json',
                error: function(result) { 
                    debugger;
                } 
            });
        }
        
        self.bookmarksList.remove(bookmark);
        //$('#bookmark-popover').hide();
        
        // store the bookmarks locally
        self.storeBookmarks();
    };

    // handle the bookmark submit
    self.saveBookmark = function() {
        // add to the list of bookmarks
        var bookmarkState = app.getState(),
            bookmark = { 
                state: bookmarkState,
                name: self.bookmarkName()
            };
            
        //if the user is logged in, ajax call to add bookmark to server 
        if (app.is_authenticated) { 
            $.ajax({ 
                url: '/visualize/add_bookmark', 
                data: { name: self.bookmarkName(), hash: window.location.hash.slice(1) }, 
                type: 'POST',
                dataType: 'json',
                error: function(result) { 
                    debugger;
                } 
            });
        }
        
        self.bookmarksList.unshift(bookmark);
        $('#bookmark-popover').hide();
        
        // store the bookmarks locally
        self.storeBookmarks();
    };

    // get the url from a bookmark
    self.getUrl = function(bookmark) {
        var host = window.location.href.split('#')[0];
        return host + "#" + $.param(bookmark.state);
    };

    self.prepareEmail = function(bookmark) {
        app.viewModel.bookmarkEmail(self.getUrl(bookmark));
    }

    self.getEmailHref = function(bookmark) {
        return "mailto:?subject=MARCO Bookmark&body=<a href='" + self.getUrl(bookmark).replace(/&/g, '%26') + "'>bookmark</a>";
    };

    // store the bookmarks to local storage
    self.storeBookmarks = function() {
        amplify.store("marco-bookmarks", self.bookmarksList());
    };

    // method for loading existing bookmarks
    self.getBookmarks = function() {
        //get bookmarks from local storage
        var existingBookmarks = amplify.store("marco-bookmarks"),
            local_bookmarks = [];
        
        if (existingBookmarks) {
            for (var i=0; i < existingBookmarks.length; i++) {
                local_bookmarks.push( {
                    'name': existingBookmarks[i].name,
                    'hash': $.param(existingBookmarks[i].state)
                });
            }
        }
        
        // load bookmarks from server while syncing with client 
        //if the user is logged in, ajax call to sync bookmarks with server 
        if (app.is_authenticated) { 
            $.ajax({ 
                url: '/visualize/get_bookmarks', 
                data: { bookmarks: local_bookmarks }, 
                type: 'POST',
                dataType: 'json',
                success: function(result) {
                    var bookmarks = result || [],
                        blist = [];
                    for (var i=0; i < bookmarks.length; i++) {
                        var bookmark = {
                            state: $.deparam(bookmarks[i].hash),
                            name: bookmarks[i].name
                        }
                        blist.push(bookmark);
                    }
                    if (blist.length > 0) {
                        self.bookmarksList(blist);
                        self.storeBookmarks();
                    }
                },
                error: function(result) { 
                    if (existingBookmarks) {
                        self.bookmarksList = ko.observableArray(existingBookmarks);
                    } 
                } 
            });
        } else if (existingBookmarks) {
            self.bookmarksList = ko.observableArray(existingBookmarks);
        } 
    };

    self.cancel = function() {
        $('#bookmark-popover').hide();
    };

    // load the bookmarks
    self.getBookmarks();

    return self;
} // end of bookmarkModel


function viewModel() {
    var self = this;

    self.modernBrowser = ko.observable( !($.browser.msie && $.browser.version < 9.0) );
    
    // list of active layermodels
    self.activeLayers = ko.observableArray();

    // list of visible layermodels in same order as activeLayers
    self.visibleLayers = ko.computed(function() {
        return $.map(self.activeLayers(), function(layer) {
            if (layer.visible()) {
                return layer;
            }
        });
    });
    
    self.visibleLayers.subscribe( function() {
        self.updateAttributeLayers();
    });
    
    self.attributeLayers = ko.observable();
    
    self.updateAttributeLayers = function() {
        var attributeLayersList = [];
        if (self.scenarios && self.scenarios.scenarioFormModel && self.scenarios.scenarioFormModel.isLeaseblockLayerVisible()) {
            attributeLayersList.push(self.scenarios.leaseblockLayer().layerModel);
        }
        
        $.each(self.visibleLayers(), function(index, layer) {
            attributeLayersList.push(layer);
        });
        self.attributeLayers(attributeLayersList);
    };
    
    // boolean flag determining whether or not to show layer panel
    self.showLayers = ko.observable(true);
    
    self.showLayersText = ko.computed(function() {
        if (self.showLayers()) return "Hide Layers";
        else return "Show Layers";
    });
    
    // toggle layer panel visibility
    self.toggleLayers = function() {
        self.showLayers(!self.showLayers());
        app.map.render('map');
        if (self.showLayers()) app.map.render('map'); //doing this again seems to prevent the vector wandering effect
        app.updateUrl();
        //if toggling layers during default pageguide, then correct step 4 position
        //self.correctTourPosition();
        //throws client-side error in pageguide.js for some reason...
    };

    // reference to open themes in accordion
    self.openThemes = ko.observableArray();
    
    self.openThemes.subscribe( function() {
        app.updateUrl();
    });

    self.getOpenThemeIDs = function() {
        return $.map(self.openThemes(), function(theme) {
            return theme.id;
        });
    };
    
    // reference to active theme model/name for display text
    self.activeTheme = ko.observable();
    self.activeThemeName = ko.observable();

    // list of theme models
    self.themes = ko.observableArray();

    // last clicked layer for editing, etc
    self.activeLayer = ko.observable();

    // determines visibility of description overlay
    self.showDescription = ko.observable();
    // determines visibility of expanded description overlay
    self.showOverview = ko.observable();
    
    // theme text currently on display
    self.themeText = ko.observable();

    // index for filter autocomplete and lookups
    self.layerIndex = {};
    self.layerSearchIndex = {};

    // viewmodel for bookmarks
    self.bookmarks = new bookmarkModel();

    self.activeBookmark = ko.observable();
    
    self.bookmarkEmail = ko.observable();
        

    // text for tooltip popup
    self.layerToolTipText = ko.observable();

    // descriptive text below the map 
    self.activeInfoLayer = ko.observable(false);
    self.activeInfoSublayer = ko.observable(false);

    // attribute data
    self.aggregatedAttributes = ko.observable(false);
    self.aggregatedAttributesWidth = ko.observable('280px');
    self.aggregatedAttributes.subscribe( function() {
        self.updateAggregatedAttributesOverlayWidthAndScrollbar();
    });
    self.removeFromAggregatedAttributes = function(layerName) {
        delete app.viewModel.aggregatedAttributes()[layerName];
        //if there are no more attributes left to display, then remove the overlay altogether
        if ($.isEmptyObject(self.aggregatedAttributes())) {
            self.closeAttribution();
        } else {
            //because the subscription on aggregatedAttributes is not triggered by this delete process
            self.updateAggregatedAttributesOverlayWidthAndScrollbar();
            //self.updateCustomScrollbar('#aggregated-attribute-content');
        }
    };
    self.updateAggregatedAttributesOverlayWidthAndScrollbar = function() {
        setTimeout( function() {
            var overlayWidth = (document.getElementById('aggregated-attribute-overlay-test').clientWidth+50),
                width = overlayWidth < 380 ? overlayWidth : 380;
            //console.log('setting overlay width to ' + width);
            self.aggregatedAttributesWidth(width + 'px');
            self.updateCustomScrollbar('#aggregated-attribute-content');
        }, 500);
    };

    // title for print view
    self.mapTitle = ko.observable();

    self.closeAttribution = function() {
        self.aggregatedAttributes(false);
        app.markers.clearMarkers();
    };
    
    self.updateMarker = function() {
        //$(elements[0]).closest('.scrollpane').data('jsp').reinitialise();  
        if (app.marker && self.aggregatedAttributes()) {
            app.markers.clearMarkers();
            app.markers.addMarker(app.marker);
            app.map.setLayerIndex(app.markers, 99);
        }
    };
    
    /*
    self.getAttributeHTML = function() {
        var html = "";
        $.each(self.activeLayers(), function(i, layer) {
            if (self.aggregatedAttributes()[layer.name]) {
                html += "<h4>"+layer.name+".<h4>";
                html += "<dl>";
                $.each(self.aggregatedAttributes()[layer.name], function(j, attrs) {
                    html += "<dt><span>"+attrs.display+"</span>:";
                    html += "<span>"+attrs.data+"</span></dt>";
                });
                html += "</dl>";
            }
        });
        return html;
    };
    */
    // hide tours for smaller screens
    self.hideTours = ko.observable(false);

    // set the error type
    // can be one of:
    //  restoreState
    self.error = ko.observable();
    self.clearError = function() {
        self.error(null);
    };
    
    self.isFullScreen = ko.observable(false);
    
    self.fullScreenWithLayers = function() {
        return self.isFullScreen() && self.showLayers();
    };

    // show the map?
    self.showMapPanel = ko.observable(true);

    //show/hide the list of basemaps
    self.showBasemaps = function(self, event) {
        var $layerSwitcher = $('#SimpleLayerSwitcher_30'),
            $button = $('#basemaps'); //$(event.target).closest('.btn');
        if ($layerSwitcher.is(":visible")) {
            $layerSwitcher.hide();
        } else {
            $layerSwitcher.show();
        }
    };

    // zoom with box
    self.zoomBoxIn = function (self, event) {
        var $button = $(event.target).closest('.btn');
        self.zoomBox($button)
    };
    self.zoomBoxOut = function (self, event) {
        var $button = $(event.target).closest('.btn');
        self.zoomBox($button, true)
    };
    self.zoomBox = function  ($button, out) {
        // out is a boolean to specify whether we are zooming in or out
        // true: zoom out
        // not present/false zoom in
        if ($button.hasClass('active')) {
            self.deactivateZoomBox();
        } else {
            $button.addClass('active');
            $button.siblings('.btn-zoom').removeClass('active');
            if (out) {
                app.map.zoomBox.out = true;
            } else {
                app.map.zoomBox.out = false;
            }
            app.map.zoomBox.activate();            
            $('#map').addClass('zoomBox');

        }
    };
    self.deactivateZoomBox = function ($button) {
        var $button = $button || $('.btn-zoom');
        app.map.zoomBox.deactivate();
        $button.removeClass('active');
        $('#map').removeClass('zoomBox');
    };

    // is the legend panel visible?
    self.showLegend = ko.observable(false);
    self.showLegend.subscribe(function (newVal) {
        self.updateScrollBars();
        if (self.printing.enabled()) {
            self.printing.showLegend(newVal);
        }

        //app.reCenterMap();

    });

    self.activeLegendLayers = ko.computed(function() {
        var layers = $.map(self.visibleLayers(), function(layer) {
            if (layer.legend || layer.legendTitle) {
                return layer;
            }
        });

        // remove any layers with duplicate legend titles
        var seen = {};
        for (i = 0; i < layers.length; i++) {
            var title = layers[i].legendTitle ? layers[i].legendTitle : layers[i].name;
            if (seen[title]) {
                layers.splice(i, 1);
                i--;
            } else {
                seen[title] = true;
            }
        }
        return layers;
    });

    self.legendButtonText = ko.computed(function() {
        if (self.showLegend()) return "Hide Legend";
        else return "Show Legend";
    });

    // toggle legend panel visibility
    self.toggleLegend = function() {
        self.showLegend(!self.showLegend());
        if (!self.showLegend()) {
            app.map.render('map');
        } else {
            //update the legend scrollbar
            //$('#legend-content').data('jsp').reinitialise();
            self.updateScrollBars();
        }
        
        //app.map.render('map');
        //if toggling legend during default pageguide, then correct step 4 position
        self.correctTourPosition();
    };

    // determine whether app is offering legends 
    self.hasActiveLegends = ko.computed(function() {
        var hasLegends = false;
        $.each(self.visibleLayers(), function(index, layer) {
            if (layer.legend || layer.legendTitle) {
                hasLegends = true;
            }
        });
        return hasLegends;
    });

    // close error-overlay
    self.closeAlert = function(self, event) {
        app.viewModel.error(null);
        $('#fullscreen-error-overlay').hide();
    };
    
    //update jScrollPane scrollbar
    self.updateScrollBars = function() {
    
        var dataScrollpane = $('#data-accordion').data('jsp');
        if (dataScrollpane === undefined) {
            $('#data-accordion').jScrollPane();
        } else {
            dataScrollpane.reinitialise();
        }
        
        var legendScrollpane = $('#legend-content').data('jsp');
        if (legendScrollpane === undefined) {
            $('#legend-content').jScrollPane();
        } else {
            setTimeout(function() {legendScrollpane.reinitialise();},100);
        }
        
    };

    // expand data description overlay
    self.expandDescription = function(self, event) {
        if ( ! self.showOverview() ) {
            self.showOverview(true);
            self.updateCustomScrollbar('#overview-overlay-text');
        } else {
            self.showOverview(false);
        }
    };
    
    self.scrollBarElements = [];
    
    self.updateCustomScrollbar = function(elem) {
        if (app.viewModel.scrollBarElements.indexOf(elem) == -1) {
            app.viewModel.scrollBarElements.push(elem);
            $(elem).mCustomScrollbar({
                scrollInertia:250,
                mouseWheel: 6
            });
        }
        //$(elem).mCustomScrollbar("update");
        setTimeout( function() { $(elem).mCustomScrollbar("update"); }, 500);
    };
    
    // close layer description
    self.closeDescription = function() {
        //self.showDescription(false);
        app.viewModel.showOverview(false);
        if ( ! app.pageguide.tourIsActive ) {
            app.viewModel.showMapAttribution();
        }
    };
    
    self.activateOverviewDropdown = function(model, event) {
        var $btnGroup = $(event.target).closest('.btn-group');
        if ( $btnGroup.hasClass('open') ) {
            $btnGroup.removeClass('open');
        } else {
            //$('#overview-dropdown-button').dropdown('toggle');  
            $btnGroup.addClass('open');
            if (app.viewModel.scrollBarElements.indexOf('#overview-overlay-dropdown') == -1) {
                app.viewModel.scrollBarElements.push('#overview-overlay-dropdown');
                $('#overview-overlay-dropdown').mCustomScrollbar({
                    scrollInertia:250,
                    mouseWheel: 6
                });
            }
            //debugger;
            //setTimeout( $('#overview-overlay-dropdown').mCustomScrollbar("update"), 1000);
            $('#overview-overlay-dropdown').mCustomScrollbar("update");
        }
    }; 
    
    self.getOverviewText = function() {
        //activeInfoSublayer() ? activeInfoSublayer().overview : activeInfoLayer().overview
        if ( self.activeInfoSublayer() ) {
            if ( self.activeInfoSublayer().overview === null ) {
                return '';
            } else {
                return self.activeInfoSublayer().overview;
            }   
        } else if (self.activeInfoLayer() ) {
            if ( self.activeInfoLayer().overview === null ) {
                return '';
            } else {
                return self.activeInfoLayer().overview;
            }  
        } else {
            return '';
        }
    };
    
    self.activeKmlLink = function() {
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().kml;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().kml;
        } else {
            return false;
        }
    };

    self.activeDataLink = function() {
        //activeInfoLayer().data_download
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().data_download;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().data_download;
        } else {
            return false;
        }
    };
    
    self.activeMetadataLink = function() {
        //activeInfoLayer().metadata
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().metadata;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().metadata;
        } else {
            return false;
        }
    };
    
    self.activeSourceLink = function() {
        //activeInfoLayer().source
        if ( self.activeInfoSublayer() ) {
            return self.activeInfoSublayer().source;
        } else if (self.activeInfoLayer() ) {
            return self.activeInfoLayer().source;
        } else {
            return false;
        }
    };
        
    //assigned in app.updateUrl (in state.js)
    self.currentURL = ko.observable();


    // show bookmark stuff
    self.showBookmarks = function(self, event) {
        var $button = $(event.target).closest('.btn'),
            $popover = $('#bookmark-popover');

        if ($popover.is(":visible")) {
            $popover.hide();
        } else {
            self.bookmarks.bookmarkName(null);
            //TODO: move all this into bookmarks model
            // hide the popover if already visible
            $popover.show().position({
                "my": "right middle",
                "at": "left middle",
                "of": $button,
                offset: "-10px 0px"
            });
        }
    };
    self.selectedLayer = ko.observable();

    self.showOpacity = function(layer, event) {
        var $button = $(event.target).closest('a'),
            $popover = $('#opacity-popover');

        self.selectedLayer(layer);

        if ($button.hasClass('active')) {
            self.hideOpacity();
        } else {
            $popover.show().position({
                "my": "center top",
                "at": "center bottom",
                "of": $button,
                "offset": "0px 10px"
            });
            $button.addClass('active');
        }
    };

    self.hideOpacity = function(self, event) {
        $('#opacity-popover').hide();
        $('.opacity-button.active').removeClass('active');
        app.updateUrl();
    };
    self.hideTooltip = function() {
        $('#layer-popover').hide();
    };


    // show coords info in pointer
    self.showPointerInfo = ko.observable(false);
    self.togglePointerInfo = function() {
        self.showPointerInfo(!self.showPointerInfo());
    };

    // get layer by id
    self.getLayerById = function(id) {
        for (var x=0; x<self.themes().length; x++) {
            var layer_list = $.grep(self.themes()[x].layers(), function(layer) { return layer.id === id });
            if (layer_list.length > 0) {
                return layer_list[0];
            }
        }
        return false;
    };

    // handle the search form
    self.searchTerm = ko.observable();
    self.layerSearch = function() {
        var found = self.layerSearchIndex[self.searchTerm()];
        //self.activeTheme(theme);
        self.openThemes.push(found.theme);
        found.layer.activateLayer();
    };
    self.keySearch = function(_, event) {

        if (event.which === 13) {
            self.searchTerm($('.typeahead .active').text());
            self.layerSearch();
        }
        $('ul.typeahead').on('click', 'li', function () {
            self.searchTerm($('.typeahead .active').text());
            self.layerSearch();
            //search($(this).text());
        });
    };

    // do this stuff when the active layers change
    self.activeLayers.subscribe(function() {
        // initial index
        var index = 300;
        app.state.activeLayers = [];

        //self.showLegend(false);
        $.each(self.activeLayers(), function(i, layer) {
            // set the zindex on the openlayers layer
            // layers at the beginning of activeLayers
            // are above those that are at the end
            // also save the layer state
            app.setLayerZIndex(layer, index);
            index--;
        });

        // re-ordering map layers by z value
        app.map.layers.sort(function(a, b) {
            return a.getZIndex() - b.getZIndex();
        });

        //update the legend scrollbar
        //setTimeout(function() {$('#legend-content').data('jsp').reinitialise();}, 200);
        setTimeout(function() { app.viewModel.updateScrollBars(); }, 200);
        
        // update the url hash
        app.updateUrl();

    });
    
    self.deactivateAllLayers = function() {
        //$.each(self.activeLayers(), function (index, layer) {
        var numActiveLayers = self.activeLayers().length;
        for (var i=0; i < numActiveLayers; i++) {
            self.activeLayers()[0].deactivateLayer();
        }
    };
    
    self.closeAllThemes = function() {
        var numOpenThemes = self.openThemes().length;
        for (var i=0; i< numOpenThemes; i++) {
            self.openThemes.remove(self.openThemes()[0]);
        }
        self.updateScrollBars();
    };

    // do this stuff when the visible layers change
    /*self.visibleLayers.subscribe(function() {
        if (!self.hasActiveLegends()) {
            self.showLegend(false);
        }
    });*/
    
    /* DESIGNS */
    
    self.showCreateButton = ko.observable(true);
    
    /* Wind Design */
    self.showWindDesignWizard = ko.observable(false);
    self.windDesignStep1 = ko.observable(false);
    self.windDesignStep2 = ko.observable(false);
    self.windDesignStep3 = ko.observable(false);
    
    self.startWindDesignWizard = function() {
        self.showCreateButton(false);
        self.showWindDesignWizard(true);
        self.showWindDesignStep1();
    };
    
    self.showWindDesignStep1 = function() {
        self.windDesignStep1(true);
        $('#wind-design-breadcrumb-step-1').addClass('active');
        self.windDesignStep2(false);
        $('#wind-design-breadcrumb-step-2').removeClass('active');
        self.windDesignStep3(false);
        $('#wind-design-breadcrumb-step-3').removeClass('active');
    };
    
    self.showWindDesignStep2 = function() {
        self.windDesignStep1(false);
        $('#wind-design-breadcrumb-step-1').removeClass('active');
        self.windDesignStep2(true);
        $('#wind-design-breadcrumb-step-2').addClass('active');
        self.windDesignStep3(false);
        $('#wind-design-breadcrumb-step-3').removeClass('active');
    };
    
    self.showWindDesignStep3 = function() {
        self.windDesignStep1(false);
        $('#wind-design-breadcrumb-step-1').removeClass('active');
        self.windDesignStep2(false);
        $('#wind-design-breadcrumb-step-2').removeClass('active');
        self.windDesignStep3(true);
        $('#wind-design-breadcrumb-step-3').addClass('active');
    };
    /* END Wind Design */
    
    self.startDefaultTour = function() {
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //ensure pageguide is managing the default guide
        $.pageguide(defaultGuide, defaultGuideOverrides);
        
        //adding delay to ensure the message will load 
        setTimeout( function() { $.pageguide('open'); }, 700 );
        //$('#help-tab').click();
        
        app.pageguide.togglingTours = false;
    };
    
    self.stepTwoOfBasicTour = function() {
        $('.pageguide-fwd')[0].click();
    }
    
    self.startDataTour = function() {
        //ensure the pageguide is closed 
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //switch pageguide from default guide to data guide
        $.pageguide(dataGuide, dataGuideOverrides);
        
        //show the data tab, close all themes and deactivate all layers, and open the Admin theme
        app.viewModel.closeAllThemes();
        app.viewModel.deactivateAllLayers();
        app.viewModel.themes()[0].setOpenTheme();
        app.setMapPosition(-73, 38.5, 7);
        $('#dataTab').tab('show');
         
        //start the tour
        setTimeout( function() { $.pageguide('open'); }, 700 );
        
        app.pageguide.togglingTours = false;
    };
    
    self.startActiveTour = function() {
        //ensure the pageguide is closed 
        if ( $.pageguide('isOpen') ) { // activated when 'tour' is clicked
            // close the pageguide
            app.pageguide.togglingTours = true;
            $.pageguide('close');
        } else {
            //save state
            app.pageguide.state = app.getState();
            app.saveStateMode = false;   
        }
        
        //show the data layers panel
        app.viewModel.showLayers(true);
        
        //switch pageguide from default guide to active guide
        $.pageguide(activeGuide, activeGuideOverrides);
        
        //show the active tab, close all themes and deactivate all layers, activate a couple layers
        //app.viewModel.closeAllThemes();
        app.viewModel.deactivateAllLayers();
        //activate desired layers
        for (var i=0; i < app.viewModel.themes()[0].layers().length; i++) {
            if ( app.viewModel.themes()[0].layers()[i].name === 'OCS Lease Blocks' ) { //might be more robust if indexOf were used
                app.viewModel.themes()[0].layers()[i].activateLayer();
            }
        }
        for (var i=0; i < app.viewModel.themes()[2].layers().length; i++) {
            if ( app.viewModel.themes()[2].layers()[i].name === 'Benthic Habitats (South)' ) {
                app.viewModel.themes()[2].layers()[i].activateLayer();
            }
        }
        app.setMapPosition(-75, 37.6, 8);
        $('#activeTab').tab('show');
        
        //start the tour
        setTimeout( function() { $.pageguide('open'); }, 700 );
        
        app.pageguide.togglingTours = false;
    };
    
    //if toggling legend or layers panel during default pageguide, then correct step 4 position
    self.correctTourPosition = function() {
        if ( $.pageguide('isOpen') ) {
            if ($.pageguide().guide().id === 'default-guide') {
                $.pageguide('showStep', $.pageguide().guide().steps.length-1);
            }
        }
    }
    
    self.showMapAttribution = function() {
        $('.olControlScaleBar').show();
        $('.olControlAttribution').show();
    }
    self.hideMapAttribution = function() {
        $('.olControlScaleBar').hide();
        $('.olControlAttribution').hide();
    }
    
    /* REGISTRATION */
    self.username = ko.observable();
    self.usernameError = ko.observable(false);
    self.password1 = ko.observable("");
    self.password2 = ko.observable("");
    self.passwordWarning = ko.observable(false);
    self.passwordError = ko.observable(false);
    self.passwordSuccess = ko.observable(false);
    self.inactiveError = ko.observable(false);
    
    self.verifyLogin = function(form) {
        var username = $(form.username).val(),
            password = $(form.password).val();
        if (username && password) {
            $.ajax({ 
                async: false,
                url: '/marco_profile/verify_password', 
                data: { username: username, password: password }, 
                type: 'POST',
                dataType: 'json',
                success: function(result) { 
                    if (result.verified === 'inactive') {
                        self.inactiveError(true);
                    } else if (result.verified === true) {
                        self.passwordError(false);
                    } else {
                        self.passwordError(true);
                    }
                },
                error: function(result) { } 
            });
            if (self.passwordError() || self.inactiveError()) {
                return false;
            } else {
                self.bookmarks.getBookmarks();
                return true;
            }
        }
        return false;
    };
    self.turnOffInactiveError = function() {
        self.inactiveError(false);
    };
    
    self.verifyPassword = function(form) {
        var username = $(form.username).val(),
            old_password = $(form.old_password).val();
        self.password1($(form.new_password1).val());
        self.password2($(form.new_password2).val());
        self.checkPassword();
        if ( ! self.passwordWarning() ) {
            if (username && old_password) {
                $.ajax({ 
                    async: false,
                    url: '/marco_profile/verify_password', 
                    data: { username: username, password: old_password }, 
                    type: 'POST',
                    dataType: 'json',
                    success: function(result) { 
                        if (result.verified === true) {
                            self.passwordError(false);
                        } else {
                            self.passwordError(true);
                        }
                    },
                    error: function(result) { } 
                });
                if (self.passwordError()) {
                    return false;
                } else {
                    return true;
                }
            }
        }
        return false;
    };
    self.turnOffPasswordError = function() {
        self.passwordError(false);
    };
    
    
    self.checkPassword = function() {
        if (self.password1() && self.password2() && self.password1() !== self.password2()) {
            self.passwordWarning(true);
            self.passwordSuccess(false);
        } else if (self.password1() && self.password2() && self.password1() === self.password2()) {
            self.passwordWarning(false);
            self.passwordSuccess(true);
        } else {
            self.passwordWarning(false);
            self.passwordSuccess(false);
        }
        return true;
    };
    
    self.checkUsername = function() {
        if (self.username()) {
            $.ajax({ 
                url: '/marco_profile/duplicate_username', 
                data: { username: self.username() }, 
                method: 'GET',
                dataType: 'json',
                success: function(result) { 
                    if (result.duplicate === true) {
                        self.usernameError(true);
                    } else {
                        self.usernameError(false);
                    }
                },
                error: function(result) { } 
            });
        }
    };
    self.turnOffUsernameError = function() {
        self.usernameError(false);
    };
    
    self.getSeaTurtleAttributes = function (title, data) {
        attrs = [];
        if ('ST_LK_NUM' in data && data['ST_LK_NUM']) {
            //attrs.push({'display': 'Sightings', 'data': data['ST_LK_NUM']});
            if (data['ST_LK_NUM'] === 99) {
                attrs.push({'display': 'Insufficient Data available for this area', 'data': ''});
            } else {
                attrs.push({'display': 'Above Average Sightings for the following species:', 'data': ''});
            }
        } else {
            attrs.push({'display': 'Sightings were in the normal range for all species', 'data': ''});
        }
        
        if ('ST_LK_NUM' in data && data['ST_LK_NUM'] ) {
            if ('GREEN_LK' in data && data['GREEN_LK']) {
                var season = data['GREEN_LK'],
                    species = 'Green Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('LEATH_LK' in data && data['LEATH_LK']) {
                var season = data['LEATH_LK'],
                    species = 'Leatherback Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('LOGG_LK' in data && data['LOGG_LK']) {
                var season = data['LOGG_LK'],
                    species = 'Loggerhead Sea Turtle',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }
        }
        return attrs;
    };
    
    self.getToothedMammalAttributes = function (title, data) {
        attrs = [];
        if ('TOO_LK_NUM' in data && data['TOO_LK_NUM']) {
            if (data['TOO_LK_NUM'] === 99) {
                attrs.push({'display': 'Insufficient Data available for this area', 'data': ''});
            } else {
                attrs.push({'display': 'Above Average Sightings for the following species:', 'data': ''});
            }
        } else {
            attrs.push({'display': 'Sightings were in the normal range for all species', 'data': ''});
        }
        if ('TOO_LK_NUM' in data && data['TOO_LK_NUM'] ) {
            if ('SPERM_LK' in data && data['SPERM_LK']) {
                var season = data['SPERM_LK'],
                    species = 'Sperm Whale',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('BND_LK' in data && data['BND_LK']) {
                var season = data['BND_LK'],
                    species = 'Bottlenose Dolphin',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }  
            if ('STRIP_LK' in data && data['STRIP_LK']) {
                var season = data['STRIP_LK'],
                    species = 'Striped Dolphin',
                    sighting = species + ' (' + season + ') ';
                attrs.push({'display': '', 'data': sighting});
            }
        }
        return attrs;
    };
    
    self.getWindSpeedAttributes = function (title, data) {
        attrs = [];
        if ('SPEED_90' in data) {
            var min_speed = (parseFloat(data['SPEED_90'])-.125).toPrecision(3),
                max_speed = (parseFloat(data['SPEED_90'])+.125).toPrecision(3);
            attrs.push({'display': 'Estimated Avg Wind Speed', 'data': min_speed + ' to ' + max_speed + ' m/s'});
        } 
        return attrs;
    };
    
    self.getOCSAttributes = function (title, data) {
        attrs = [];
        if ('BLOCK_LAB' in data) {
            attrs.push({'display': 'OCS Block Number', 'data': data['BLOCK_LAB']});
        }
        if ('PROT_NUMBE' in data) {
            attrs.push({'display': 'Protraction Number', 'data': data['PROT_NUMBE']});
        }
        if ('WINDREV_MI' in data && 'WINDREV_MA' in data) {
            if ( data['WINDREV_MI'] ) {                
                var min_speed = data['WINDREV_MI'].toFixed(3),
                    max_speed = data['WINDREV_MA'].toFixed(3),
                    min_range = (parseFloat(min_speed)-.125).toPrecision(3),
                    max_range = (parseFloat(max_speed)+.125).toPrecision(3);
                /*if ( min_speed === max_speed ) {
                    attrs.push({'display': 'Estimated Avg Wind Speed (m/s)', 'data': speed});
                } else {
                    var speed = (min_speed-.125) + ' to ' + (max_speed+.125);
                    attrs.push({'display': 'Estimated Avg Wind Speed (m/s)', 'data': speed});
                }*/
                attrs.push({'display': 'Estimated Avg Wind Speed', 'data': min_range + ' to ' + max_range + ' m/s'});
            } else {
                attrs.push({'display': 'Estimated Avg Wind Speed', 'data': 'no data'});
            }
        }
        if ('MI_MIN' in data && 'MI_MAX' in data) {
            attrs.push({'display': 'Distance to Shore', 'data': data['MI_MIN'].toFixed(0) + ' to ' + data['MI_MAX'].toFixed(0) + ' miles'});
        }
        if ('DEPTHM_MIN' in data && 'DEPTHM_MAX' in data) {
            if ( data['DEPTHM_MIN'] ) {
                //convert depth values to positive feet values (from negative meter values)
                var max_depth = (-data['DEPTHM_MAX'] * 3.2808399).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                    min_depth = (-data['DEPTHM_MIN'] * 3.2808399).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                attrs.push({'display': 'Depth Range', 'data': max_depth + ' to ' + min_depth + ' feet'});
            } else {
                attrs.push({'display': 'Depth Range', 'data': 'no data'});
            }
        }
        if ('AWCMI_MIN' in data && 'AWCMI_MAX' in data) {
            attrs.push({'display': 'Distance to Proposed AWC Hub', 'data': data['AWCMI_MIN'].toFixed(0) + ' to ' + data['AWCMI_MAX'].toFixed(0) + ' miles'});
        }
        if ('TRSEP_MIN' in data && 'TRSEP_MAX' in data) {
            attrs.push({'display': 'Distance to Shipping Lanes', 'data': data['TRSEP_MIN'].toFixed(0) + ' to ' + data['TRSEP_MAX'].toFixed(0) + ' miles'});
        }
        if ('AIS7_MEAN' in data) {
            if ( data['AIS7_MEAN'] < 1 ) {
                var rank = 'Low';
            } else {
                var rank = 'High';
            }
            attrs.push({'display': 'Commercial Ship Traffic Density', 'data': rank });
        }
        if ('WEA_NAME' in data) {
            if ( data['WEA_NAME'].replace(/\s+/g, '') !== "" ) {
                attrs.push({'display': 'Part of ' + data['WEA_NAME'] + ' WPA', 'data': null});
            }
        }
        return attrs;
    };
            
    return self;
} //end viewModel

app.viewModel = new viewModel();
