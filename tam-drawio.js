
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
    tamStateHandler.prototype = new mxEdgeHandler();
    tamStateHandler.prototype.constructor = tamStateHandler;
    tamStateHandler.prototype.domNode = null;

    tamStateHandler.prototype.changePoints = function (edge,
        points,
        clone) {
        mxUtils.alert(JSON.stringify(points));
    }

    tamStateHandler.prototype.init = function () {
        /*
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
        */
    };
    tamStateHandler.prototype.redraw = function () {
        mxVertexHandler.prototype.redraw.apply(this);
        //this.redrawTools();
    };
    /*tamStateHandler.prototype.redrawTools = function () {
        if (this.state !== null && this.domNode !== null) {
            var dy = (mxClient.IS_VML && document.compatMode === 'CSS1Compat') ? 20 : 4;
            this.domNode.style.left = (this.state.x + this.state.width - this.domNode.children.length * 14) + 'px';
            this.domNode.style.top = (this.state.y + this.state.height + dy) + 'px';
        }
    };*/
    tamStateHandler.prototype.destroy = function (sender, me) {
        mxVertexHandler.prototype.destroy.apply(this, arguments);
        if (this.domNode !== null) {
            this.domNode.parentNode.removeChild(this.domNode);
            this.domNode = null;
        }
    };



    useRelationshipNoCurveH = function () {
    };
    useRelationshipNoCurveH.prototype.handler = tamStateHandler;
    useRelationshipNoCurveH.prototype.create = function () {
        return getUseArrow('endArrow=none;html=1;bendable=0;',
            { x: 0, y: 0 },
            { x: 160, y: 0 },
            false);
    };
    tamUtils.registCodec(useRelationshipNoCurveH);

    useRelationshipNoCurveV = function () {
    };
    useRelationshipNoCurveV.prototype.handler = tamStateHandler;
    useRelationshipNoCurveV.prototype.create = function () {
        return getUseArrow('endArrow=none;html=1;bendable=0;',
            { x: 0, y: 0 },
            { x: 0, y: 160 },
            true);
    };
    tamUtils.registCodec(useRelationshipNoCurveV);


    useRelationshipCurveV = function () {
    };
    useRelationshipCurveV.prototype.handler = tamStateHandler;
    useRelationshipCurveV.prototype.create = function () {
        return getUseArrow('edgeStyle=elbowEdgeStyle;elbow=horizontal;endArrow=none;html=1;bendable=0;',
            { x: 0, y: 0 },
            { x: 160, y: 100 },
            true);
    };
    tamUtils.registCodec(useRelationshipCurveV);

    useRelationshipCurveH = function () {
    };
    useRelationshipCurveH.prototype.handler = tamStateHandler;
    useRelationshipCurveH.prototype.create = function () {
        return getUseArrow('edgeStyle=elbowEdgeStyle;elbow=vertical;endArrow=none;html=1;bendable=0;',
            { x: 0, y: 0 },
            { x: 160, y: 100 },
            false);
    };
    tamUtils.registCodec(useRelationshipCurveH);


    storage = function () {
    };
    storage.prototype.handler = tamStateHandler;
    storage.prototype.create = function () {
        return getStorage();
    };
    tamUtils.registCodec(storage);

    updateEdgeV = function () {
    };
    updateEdgeV.prototype.handler = tamStateHandler;
    updateEdgeV.prototype.create = function () {
        return getVerticalUpdateEdge(true);
    };
    tamUtils.registCodec(updateEdgeV);

    updateEdgeH = function () {
    };
    updateEdgeH.prototype.handler = tamStateHandler;
    updateEdgeH.prototype.create = function () {
        return getHorizontalUpdateEdge(false);
    };
    tamUtils.registCodec(updateEdgeH);

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


        var classCell1 = new mxCell('', new mxGeometry(0, 0, 20, 20), 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;deletable=0;movable=0;');
        classCell1.vertex = true;
        classCell1.connectable = false;
        classCell1.geometry.relative = true;
        classCell1.geometry.offset = new mxPoint(-10, -10);
        cell.insert(classCell1);

        var triangle = new mxCell('', new mxGeometry(0, 0, 10, 10), 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;deletable=0;movable=0;' + (isVertical ? 'rotation=90;' : ''));
        triangle.setValue(mxUtils.createXmlDocument().createElement('object'));
        triangle.value.setAttribute('triangle', 'true');

        triangle.vertex = true;
        triangle.connectable = false;
        triangle.geometry.relative = true;
        triangle.geometry.offset = isVertical ? T_ns : T_we;
        cell.insert(triangle);

        var R = new mxCell('R', new mxGeometry(0, 0, 10, 10), 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;deletable=0;movable=0;');
        R.vertex = true;
        R.connectable = false;
        R.geometry.relative = true;
        R.geometry.offset = isVertical ? R_ns : R_we;
        cell.insert(R);


        return cell;
    }

    function getStorage() {
        var cell = new mxCell('', new mxGeometry(0, 0, 90, 40), 'rounded=1;whiteSpace=wrap;html=1;arcSize=60;');
        cell.vertex = true;

        return cell;

    }

    function getVerticalUpdateEdge() {
        var cell = new mxCell('', new mxGeometry(0, 0, 30, 80), 'shape=updateedge;endArrow=none;vertical=true;');
        cell.geometry.relative = true;
        cell.edge = true;
        cell.geometry.setTerminalPoint(new mxPoint(15, 0), true);
        cell.geometry.setTerminalPoint(new mxPoint(15, 80), false);
        return cell;
    }
    function getHorizontalUpdateEdge() {
        var cell = new mxCell('', new mxGeometry(0, 0, 80, 30), 'shape=updateedge;endArrow=none;');
        cell.geometry.relative = true;
        cell.edge = true;
        cell.geometry.setTerminalPoint(new mxPoint(0, 15), true);
        cell.geometry.setTerminalPoint(new mxPoint(80, 15), false);
        return cell;
    }

    // UpdateShape Shape
    function UpdateEdgeShape() {
        mxConnector.call(this);
    };
    mxUtils.extend(UpdateEdgeShape, mxConnector);
    UpdateEdgeShape.prototype.origPaintEdgeShape = UpdateEdgeShape.prototype.paintEdgeShape;

    UpdateEdgeShape.prototype.paintEdgeShape = function (c, pts, rounded) {

        var sourceMarker = this.createMarker(c, pts, true);
        var targetMarker = this.createMarker(c, pts, false);
        var dashed = c.state.dashed;
        var fixDash = c.state.fixDash;


        c.setFillColor(this.stroke);
        c.setDashed(dashed, fixDash);
        c.setShadow(false);

        if (pts.length < 2) {
            return;
        }
        let isVertical = mxUtils.getValue(this.style, 'vertical', false);
        if (isVertical) {
            drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x + 5, pts[1].y - 5, isVertical, false);
            drawArrow(c, pts[0].x - 5, pts[0].y + 5, pts[1].x - 5, pts[1].y - 5, isVertical, true);
        } else {
            drawArrow(c, pts[0].x + 5, pts[0].y - 5, pts[1].x - 5, pts[1].y - 5, isVertical, true);
            drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x - 5, pts[1].y + 5, isVertical, false);
        }


        // let m = this.createMarker(c, [new mxPoint(pts[0].x + gap, pts[0].y +5)], true);
        // if (m) {
        //     m();
        // }

        if (sourceMarker != null) {
            sourceMarker();
        }

        if (targetMarker != null) {
            targetMarker();
        }

    };

    function drawArrow(c, x1, y1, x2, y2, isVertical, isLeftUp) {
        let cWidth = isLeftUp ? -10 : 10;
        let dx = 1;
        let dy = 1;
        let ArrowLength = 4;

        c.begin();
        if (isVertical) {
            let h = y2 - y1;
            c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y1 + (isLeftUp ? ArrowLength : dy));
            c.lineTo(x1, y1);
            c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));

            c.moveTo(x1, y1);
            c.curveTo(x1 + cWidth, y1 + h / 3,
                x1 + cWidth, y1 + 2 * h / 3,
                x1, y2);

            c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y2 - (isLeftUp ? ArrowLength : dy));
            c.lineTo(x1, y2);
            c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y2 - (isLeftUp ? dx : ArrowLength));
        } else {
            let w = x2 - x1;
            c.moveTo(x1 + (isLeftUp ? dy : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
            c.lineTo(x1, y1);
            c.lineTo(x1 + (isLeftUp ? ArrowLength : dx), y1 + (isLeftUp ? dy : ArrowLength));

            c.moveTo(x1, y1);
            c.curveTo(x1 + w / 3, y1 + cWidth,
                x1 + 2 * w / 3, y1 + cWidth,
                x2, y1);

            c.moveTo(x2 - (isLeftUp ? dx : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
            c.lineTo(x2, y1);
            c.lineTo(x2 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));

        }
        c.stroke();
    }


    UpdateEdgeShape.prototype.getLabelMargins = function (rect) {
        return new mxRectangle(0, 2.5 * Math.min(rect.height / 2,
            Math.round(rect.height / 8) + this.strokewidth - 1), 0, 0);
    }

    mxCellRenderer.registerShape('updateedge', UpdateEdgeShape);






    // Adds custom sidebar entry
    ui.sidebar.addPalette(sidebar_id, sidebar_title, true, function (content) {

        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipNoCurveH.prototype.create()], 160, 0, 'Use straight horizontal '));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipNoCurveV.prototype.create()], 160, 0, 'Use straight vertical '));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipCurveV.prototype.create()], 160, 0, 'Use curved vertical'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([useRelationshipCurveH.prototype.create()], 160, 0, 'Use curved horizontal'));
        //content.appendChild(ui.sidebar.createEdgeTemplateFromCells([storage.prototype.create()], 160, 0, 'Storage'));
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=1;whiteSpace=wrap;html=1;arcSize=60;', 90, 40, ''));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([updateEdgeV.prototype.create()], 160, 0, 'Update line vertical'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([updateEdgeH.prototype.create()], 160, 0, 'Update line horizontal'));


    });

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
    elt.firstChild.style.backgroundImage = 'url(https://raw.githubusercontent.com/ariel-bentu/tam-drawio/main/resources/swap.gif)';
    elt.firstChild.style.backgroundPosition = '2px 3px';


});