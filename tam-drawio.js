
Draw.loadPlugin(function (ui) {
    var sidebar_id = 'TAM';
    var sidebar_title = 'TAM Notation';

    var tamUtils = {};

    tamUtils.isTam = function (cell) {
        return (cell &&
            cell.hasOwnProperty('value') &&
            (cell.value && cell.value.hasAttribute &&
                cell.value.hasAttribute('tamType'))
        );
    };

    tamUtils.getStyleValue = (cell, name) => {
        let style = cell.style;
        //mxUtils.alert(style)
        let styleArr = style.split(';')
        //mxUtils.alert(JSON.stringify(styleArr));
        var res = styleArr.filter(function (value) {
            let keyVal = value.split('=');
            return keyVal[0] == name;
        });

        if (res && res.length == 1) {
            let keyVal = res[0].split('=');
            if (keyVal.length == 2) {
                return keyVal[1];
            }
        }
        return '';
    }

    tamUtils.isTriangle = function (cell) {
        return (cell &&
            cell.hasOwnProperty('value') &&
            (cell.value && cell.value.hasAttribute &&
                cell.value.hasAttribute('triangle'))
        );
    };

    tamUtils.registCodec = function (func) {
        var codec = new mxObjectCodec(new func());
        codec.encode = function (enc, obj) {
            try {
                var data = enc.document.createElement(func.name);
            } catch (e) {
                (window.console && console.error(e));
            }
            return data
        };
        codec.decode = function (dec, node, into) {
            return new func();
        };
        mxCodecRegistry.register(codec);
    };

    tamStateHandler = function (state) {
        mxVertexHandler.apply(this, arguments);
    };
    tamStateHandler.prototype = new mxVertexHandler();
    tamStateHandler.prototype.constructor = tamStateHandler;
    tamStateHandler.prototype.domNode = null;
    tamStateHandler.prototype.init = function () {
        mxVertexHandler.prototype.init.apply(this, arguments);
        this.domNode = document.createElement('div');
        this.domNode.style.position = 'absolute';
        this.domNode.style.whiteSpace = 'nowrap';
        if (this.custom) this.custom.apply(this, arguments);
        var img = tamUtils.createSettingsIcon();
        mxEvent.addGestureListeners(img,
            mxUtils.bind(this, function (evt) {
                mxEvent.consume(evt);
            })
        );
        this.domNode.appendChild(img);
        this.graph.container.appendChild(this.domNode);
        this.redrawTools();
    };
    tamStateHandler.prototype.redraw = function () {
        mxVertexHandler.prototype.redraw.apply(this);
        this.redrawTools();
    };
    tamStateHandler.prototype.redrawTools = function () {
        if (this.state !== null && this.domNode !== null) {
            var dy = (mxClient.IS_VML && document.compatMode === 'CSS1Compat') ? 20 : 4;
            this.domNode.style.left = (this.state.x + this.state.width - this.domNode.children.length * 14) + 'px';
            this.domNode.style.top = (this.state.y + this.state.height + dy) + 'px';
        }
    };
    tamStateHandler.prototype.destroy = function (sender, me) {
        mxVertexHandler.prototype.destroy.apply(this, arguments);
        if (this.domNode !== null) {
            this.domNode.parentNode.removeChild(this.domNode);
            this.domNode = null;
        }
    };



    useRelationshipNoCurve = function () {
    };
    useRelationshipNoCurve.prototype.handler = tamStateHandler;
    useRelationshipNoCurve.prototype.create = function () {
        return getUseArrow('endArrow=none;html=1;',
            { x: 0, y: 0 },
            { x: 160, y: 0 },
            false);
    };
    tamUtils.registCodec(useRelationshipNoCurve);


    useRelationshipCurveV = function () {
    };
    useRelationshipCurveV.prototype.handler = tamStateHandler;
    useRelationshipCurveV.prototype.create = function () {
        return getUseArrow('edgeStyle=elbowEdgeStyle;elbow=horizontal;endArrow=none;html=1;',
            { x: 0, y: 0 },
            { x: 160, y: 100 },
            true);
    };
    tamUtils.registCodec(useRelationshipCurveV);

    useRelationshipCurveH = function () {
    };
    useRelationshipCurveH.prototype.handler = tamStateHandler;
    useRelationshipCurveH.prototype.create = function () {
        return getUseArrow('edgeStyle=elbowEdgeStyle;elbow=vertical;endArrow=none;html=1;',
            { x: 0, y: 0 },
            { x: 160, y: 100 },
            false);
    };
    tamUtils.registCodec(useRelationshipCurveH);

    const R_we = new mxPoint(-8, -30);
    const R_ew = new mxPoint(8, -30);
    const R_ns = new mxPoint(-30, -8);
    const R_sn = new mxPoint(-30, 8);

    const T_we = new mxPoint(5, -30);
    const T_ew = new mxPoint(-5, -30);
    const T_ns = new mxPoint(-30, 5)
    const T_sn = new mxPoint(-30, -5);

    function getRPoint(rotation) {
        switch (rotation) {
            case -90:
            case 270:
                return R_sn;
            case 0:
                return R_we;
            case 90:
                return R_ns
            case 180:
                return R_ew
        }
        return R_we;
    }

    function getTPoint(rotation) {
        switch (rotation) {
            case -90:
            case 270:
                return T_sn;
            case 0:
                return T_we;
            case 90:
                return T_ns
            case 180:
                return T_ew
        }
        return T_we;
    }

    function getUseArrow(style, startPt, endPt, isVertical) {
        var cell = new mxCell('', new mxGeometry(startPt.x, startPt.y, endPt.x, endPt.y), style);
        cell.setValue(mxUtils.createXmlDocument().createElement('object'));
        cell.geometry.setTerminalPoint(new mxPoint(startPt.x, startPt.y), true);
        cell.geometry.setTerminalPoint(new mxPoint(endPt.x, endPt.y), false);
        cell.geometry.relative = true;
        cell.edge = true;
        cell.value.setAttribute('tamType', 'use');


        var classCell1 = new mxCell('', new mxGeometry(0, 0, 20, 20), 'ellipse;whiteSpace=wrap;html=1;aspect=fixed');
        classCell1.vertex = true;
        classCell1.connectable = false;
        classCell1.geometry.relative = true;
        classCell1.geometry.offset = new mxPoint(-10, -10);
        cell.insert(classCell1);

        var triangle = new mxCell('', new mxGeometry(0, 0, 10, 10), 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;' + (isVertical ? 'rotation=90;' : ''));
        triangle.setValue(mxUtils.createXmlDocument().createElement('object'));
        triangle.value.setAttribute('triangle', 'true');

        triangle.vertex = true;
        triangle.connectable = false;
        triangle.geometry.relative = true;
        triangle.geometry.offset = isVertical ? T_ns : T_we;
        cell.insert(triangle);

        var R = new mxCell('R', new mxGeometry(0, 0, 10, 10), 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;');
        R.vertex = true;
        R.connectable = false;
        R.geometry.relative = true;
        R.geometry.offset = isVertical ? R_ns : R_we;
        cell.insert(R);


        return cell;
    }



    // Adds custom sidebar entry
    ui.sidebar.addPalette(sidebar_id, sidebar_title, true, function (content) {

        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipNoCurve.prototype.create()], 160, 0, 'Use straight horizontal '));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipCurveV.prototype.create()], 160, 0, 'Use curved vertical'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipCurveH.prototype.create()], 160, 0, 'Use curved horizontal'));

    });

    process.stdout.write(ui.toolbar && ui.toolbar.addItem ? "add item is defined\n" : "toolbar is undefined\n");

    mxResources.parse('flipUse=Flip Use Direction');

    // Adds action
    ui.actions.addAction('flipUse', function () {
        if (!ui.editor.graph.isSelectionEmpty() && !ui.editor.graph.isEditing()) {

            let cells = ui.editor.graph.getSelectionCells();
            if (tamUtils.isTam(cells[0])) {
                let newRotation = 0;

                //rotation of triangle
                let triangle = cells[0].children[1];
                let rotation = tamUtils.getStyleValue(triangle, 'rotation');

                if (rotation == '') {
                    newRotation = 180
                } else {
                    newRotation = parseInt(rotation) + 180;
                    if (newRotation >= 360) {
                        newRotation -= 360;
                    }
                }
                
                
                triangle.setStyle(mxUtils.setStyle(triangle.style, 'rotation', newRotation));
                triangle.geometry.offset = getTPoint(newRotation);
                ui.editor.graph.refresh(triangle);

                //location or "R"
                let R = cells[0].children[2];
                R.geometry.offset = getRPoint(newRotation);
                ui.editor.graph.refresh(R);
            } else {
                mxUtils.alert("Not TAM element!");
            }
        }
    });

    ui.toolbar.addSeparator();

    var elt = ui.toolbar.addItem('', 'flipUse');

    // Cannot use built-in sprites
    elt.firstChild.style.backgroundImage = 'url(https://github.com/ariel-bentu/tam-drawio/blob/main/resources/swap.png)';
    elt.firstChild.style.backgroundPosition = '2px 3px';


});