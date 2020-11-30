
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


    storage = function () {
    };
    storage.prototype.create = function () {
        return getStorage();
    };
    tamUtils.registCodec(storage);

    updateEdgeV = function () {
    };
    updateEdgeV.prototype.create = function () {
        return getVerticalUpdateEdge(true);
    };
    tamUtils.registCodec(updateEdgeV);

    updateEdgeH = function () {
    };
    updateEdgeH.prototype.create = function () {
        return getHorizontalUpdateEdge(false);
    };
    tamUtils.registCodec(updateEdgeH);


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
            drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x + 5, pts[1].y - 5, isVertical, false, true, false);
            drawArrow(c, pts[0].x - 5, pts[0].y + 5, pts[1].x - 5, pts[1].y - 5, isVertical, true, false, true);
        } else {
            drawArrow(c, pts[0].x + 5, pts[0].y - 5, pts[1].x - 5, pts[1].y - 5, isVertical, true, true, false);
            drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x - 5, pts[1].y + 5, isVertical, false, false, true);
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

    function drawArrow(c, x1, y1, x2, y2, isVertical, isLeftUp, startArrow, endArrow) {
        let cWidth = isLeftUp ? -10 : 10;
        let dx = 1;
        let dy = 1;
        let ArrowLength = 4;

        c.begin();
        if (isVertical) {
            let h = y2 - y1;
            if (startArrow) {
                c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y1 + (isLeftUp ? ArrowLength : dy));
                c.lineTo(x1, y1);
                c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));
            }

            c.moveTo(x1, y1);
            c.curveTo(x1 + cWidth, y1 + h / 3,
                x1 + cWidth, y1 + 2 * h / 3,
                x1, y2);
            if (endArrow) {
                c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y2 - (isLeftUp ? ArrowLength : dy));
                c.lineTo(x1, y2);
                c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y2 - (isLeftUp ? dx : ArrowLength));
            }
        } else {
            let w = x2 - x1;
            if (startArrow) {
                c.moveTo(x1 + (isLeftUp ? dy : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
                c.lineTo(x1, y1);
                c.lineTo(x1 + (isLeftUp ? ArrowLength : dx), y1 + (isLeftUp ? dy : ArrowLength));
            }
            c.moveTo(x1, y1);
            c.curveTo(x1 + w / 3, y1 + cWidth,
                x1 + 2 * w / 3, y1 + cWidth,
                x2, y1);
            if (endArrow) {
                c.moveTo(x2 - (isLeftUp ? dx : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
                c.lineTo(x2, y1);
                c.lineTo(x2 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));
            }
        }
        c.stroke();
    }


    UpdateEdgeShape.prototype.getLabelMargins = function (rect) {
        return new mxRectangle(0, 2.5 * Math.min(rect.height / 2,
            Math.round(rect.height / 8) + this.strokewidth - 1), 0, 0);
    }

    mxCellRenderer.registerShape('updateedge', UpdateEdgeShape);

    function UseEdge() {
        mxConnector.call(this);
    };
    mxUtils.extend(UseEdge, mxConnector);

    UseEdge.prototype.paintEdgeShape = function (c, pts, rounded) {
        var sourceMarker = this.createMarker(c, pts, true);
        var targetMarker = this.createMarker(c, pts, false);
        var dashed = c.state.dashed;
        var fixDash = c.state.fixDash;


        c.setDashed(dashed, fixDash);
        c.setShadow(false);

        if (pts.length < 2) {
            return;
        }
        let isVertical = mxUtils.getValue(this.style, 'vertical', false);

        //draw-line (always straight)
        mxPolyline.prototype.paintEdgeShape.apply(this, arguments);

        //Draw circle
        let i = pts.length > 3 ? 1 : 0

        let x = pts[i].x + (pts[i + 1].x - pts[i].x) / 2;
        let y = pts[i].y + (pts[i + 1].y - pts[i].y) / 2;

        let fillColor = mxUtils.getValue(this.style, 'fillColor', '');
        if (fillColor != '') {
            c.setFillColor(fillColor)
        } else {
            if (uiTheme == 'dark') {
                c.setFillColor('#000000')
            } else {
                c.setFillColor('#FFFFFF')
            }
        }
        let strokeTmp = this.strokewidth;
        c.setStrokeWidth(2);

        c.ellipse(x - 10, y - 10, 20, 20);
        c.fillAndStroke();

        c.setStrokeWidth(strokeTmp);

        //Draw triangle
        let useSignPosition = mxUtils.getValue(this.style, 'useSignPosition', 'up');
        let useSignDirection = mxUtils.getValue(this.style, 'useSignDirection', 'north');



        let dx, dy;
        let tpts, rpt

        c.begin()
        switch (useSignPosition) {
            case 'down':
                dy = 25;
                dx = 0;
                break;
            case 'left':
                dy = 0;
                dx = -25;

                break;
            case 'right':
                dy = 0;
                dx = -25;
                break;
            case 'up':
            default:
                dy = -25;
                dx = 0;
        }
        switch (useSignDirection) {
            case 'north':
                dy += -5;
                tpts = [[-5, 0], [0, -10], [5, 0], [0, -2]];
                rpt = [-5, 5]
                break;
            case 'south':
                dy += 5;
                tpts = [[-5, 0], [0, 10], [5, 0], [0, 2]];
                rpt = [-5, -15]
                break;
            case 'west':
                dx += -5;
                tpts = [[0, -5], [-10, 0], [0, 5], [-2, 0]];
                rpt = [5, -5]
                break;
            case 'east':
            default:
                dx += 5;
                tpts = [[0, -5], [10, 0], [0, 5], [2, 0]];
                rpt = [-15, -5]
        }
        c.translate(x + dx, y + dy);

        c.moveTo(tpts[0][0], tpts[0][1]);
        for (let i = 1; i < tpts.length; i++) {
            c.lineTo(tpts[i][0], tpts[i][1]);
        }
        c.lineTo(tpts[0][0], tpts[0][1]);

        c.close();
        c.end();
        c.setFillColor(this.stroke)
        c.fillAndStroke();

        //Output the R
        c.setFontColor(this.stroke)
        c.text(rpt[0], rpt[1], 10, 10, "R");

        if (sourceMarker != null) {
            sourceMarker();
        }

        if (targetMarker != null) {
            targetMarker();
        }


    };

    mxCellRenderer.registerShape('useedge', UseEdge);


    function Dot3() {
        mxCylinder.call(this);
    };

    mxUtils.extend(Dot3, mxCylinder);

    Dot3.prototype.paintVertexShape = function (c, x, y, w, h) {
        let isVertical = mxUtils.getValue(this.style, 'vertical', false);
        let radius = isVertical ? 2 * w / 3 : 2 * h / 3;
        c.setFillColor(this.stroke);

        let x1 = x + radius * .25;
        let y1 = y + radius * .25;

        let dx = isVertical ? 0 : radius * 1.8;
        let dy = isVertical ? radius * 1.8 : 0;
        c.ellipse(x1, y1, radius, radius);
        c.fillAndStroke();

        c.ellipse(x1 + dx, y1 + dy, radius, radius);
        c.fillAndStroke();

        c.ellipse(x1 + 2 * dx, y1 + 2 * dy, radius, radius);
        c.fillAndStroke();

    };

    mxCellRenderer.registerShape('dot3', Dot3);

    function Agent() {
        mxRectangleShape.call(this);
    };

    mxUtils.extend(Agent, mxRectangleShape);

    Agent.prototype.paintVertexShape = function (c, x, y, w, h) {
        let multiple = mxUtils.getValue(this.style, 'multiple', false);
        let offsetSize = mxUtils.getValue(this.style, 'offsetSize', 8);

        if (multiple) {
            drawRect(c, x + offsetSize, y - offsetSize, w, h);
        }
        drawRect(c, x, y, w, h);
    };

    function drawRect(c, x, y, w, h) {
        c.begin();
        c.moveTo(x, y);
        c.lineTo(x + w, y);
        c.lineTo(x + w, y + h);
        c.lineTo(x, y + h);
        c.lineTo(x, y);
        c.close();
        c.end();
        c.fillAndStroke()
    }

    mxCellRenderer.registerShape('agent', Agent);

    function Actor() {
        mxRectangleShape.call(this);
    };

    mxUtils.extend(Actor, mxRectangleShape);

    Actor.prototype.paintVertexShape = function (c, x, y, w, h) {
        drawRect(c, x, y, w, h);
        let margin = mxUtils.getValue(this.style, 'margin', 10);
        x += margin / 2;
        y += margin / 2;
        w -= margin;
        h -= margin;

        c.translate(x, y);

        // Head
        c.ellipse(w / 4, 0, w / 2, h / 4);
        c.fillAndStroke();

        c.begin();
        c.moveTo(w / 2, h / 4);
        c.lineTo(w / 2, 2 * h / 3);

        // Arms
        c.moveTo(w / 2, h / 3 + 3);
        c.lineTo(0, h / 3 );
        c.moveTo(w / 2, h / 3 + 3);
        c.lineTo(w, h / 3);

        // Legs
        c.moveTo(w / 2, 2 * h / 3);
        c.lineTo(0, h);
        c.moveTo(w / 2, 2 * h / 3);
        c.lineTo(w, h);
        c.end();

        c.stroke();
    };

    

    mxCellRenderer.registerShape('actor', Actor);


    // Adds custom sidebar entry
    ui.sidebar.addPalette(sidebar_id, sidebar_title, true, function (content) {
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;vertical=true;endArrow=none;useSignPosition=left;useSignDirection=south;', 0, 160, ''));
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;endArrow=none;useSignPosition=up;useSignDirection=east;', 160, 0, ''));
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;vertical=true;edgeStyle=elbowEdgeStyle;elbow=vertical;endArrow=none;useSignPosition=up;useSignDirection=east;', 70, 160, ''));
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;edgeStyle=elbowEdgeStyle;elbow=horizontal;endArrow=none;useSignPosition=left;useSignDirection=south;', 160, 70, ''));
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=1;whiteSpace=wrap;html=1;arcSize=60;', 90, 40, ''));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=dot3;vertical=true;connectable=0;', 15, 55, ''));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=dot3;connectable=0;', 55, 15, ''));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([updateEdgeV.prototype.create()], 160, 0, 'Update line vertical'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([updateEdgeH.prototype.create()], 160, 0, 'Update line horizontal'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=agent;offsetSize=8;strokeWidth=2;', 100, 60, ''));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=agent;offsetSize=8;strokeWidth=2;multiple=true;', 100, 60, ''));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=actor;horizontalLabelPosition=right;align=left;labelPosition=right;strokeWidth=2;', 25, 50, ''));
    });

    mxResources.parse('flipUse=Flip Use Direction');

    // Adds action
    ui.actions.addAction('flipUse', function () {

        if (!ui.editor.graph.isSelectionEmpty() && !ui.editor.graph.isEditing()) {

            let cells = ui.editor.graph.getSelectionCells();

            let useSignDirection = tamUtils.getStyleValue(cells[0], 'useSignDirection');
            if (useSignDirection == '') {
                mxUtils.alert("Not a Use-relationship element!");
                return;
            }

            switch (useSignDirection) {
                case 'north':
                    useSignDirection = 'south'
                    break;
                case 'south':
                    useSignDirection = 'north'
                    break;
                case 'west':
                    useSignDirection = 'east'
                    break;
                case 'east':
                    useSignDirection = 'west'
            }

            cells[0].setStyle(mxUtils.setStyle(cells[0].style, 'useSignDirection', useSignDirection));
            ui.editor.graph.refresh(cells[0]);

        }
    });

    ui.toolbar.addSeparator();

    var elt = ui.toolbar.addItem('', 'flipUse');

    // Cannot use built-in sprites
    elt.firstChild.style.backgroundImage = 'url(https://raw.githubusercontent.com/ariel-bentu/tam-drawio/main/resources/swap.gif)';
    elt.firstChild.style.backgroundPosition = '2px 3px';


});
