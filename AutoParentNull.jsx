/*
  Auto Parent Null Script
  1. Creates a single Null for all selected layers.
  2. Places the Null at the Anchor Point of the top-most selected layer.
  3. Adjusts the Null's duration to cover all selected layers.
  4. Parents selected layers to the Null while maintaining their visual position.
  5. Works with mixed selections (Videos, Images, Nulls).
*/

(function() {
    var comp = app.project.activeItem;

    // Check if a composition is open
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please open a composition.");
        return;
    }

    var sel = comp.selectedLayers;
    if (sel.length === 0) {
        alert("Please select at least one layer.");
        return;
    }

    app.beginUndoGroup("Add Parent Null");

    // -----------------------------------------------------
    // 1. Sort Selection & Gather Data
    // -----------------------------------------------------
    
    // Convert selection collection to a standard array for sorting
    var selArray = [];
    for (var i = 0; i < sel.length; i++) {
        selArray.push(sel[i]);
    }
    
    // Sort by index (top to bottom) to identify the visual "Lead" layer
    selArray.sort(function(a, b) { return a.index - b.index; });

    var leadLayer = selArray[0]; // The top-most layer
    var leadIndexOriginal = leadLayer.index;
    
    // Initialize bounds and 3D status
    var minIn = leadLayer.inPoint;
    var maxOut = leadLayer.outPoint;
    var globalHas3D = false;

    // Array to store metadata (Snapshot of current state)
    var layersMeta = [];

    for (var i = 0; i < selArray.length; i++) {
        var L = selArray[i];
        
        // Update timing bounds
        if (L.inPoint < minIn) minIn = L.inPoint;
        if (L.outPoint > maxOut) maxOut = L.outPoint;
        if (L.threeDLayer) globalHas3D = true;

        // Store ABSOLUTE world position to ensure stability
        var wPos = [0,0,0];
        try {
            if (L.threeDLayer) {
                wPos = L.toWorld(L.anchorPoint.value);
            } else {
                var t = L.toComp(L.anchorPoint.value);
                wPos = [t[0], t[1], 0];
            }
        } catch(err) {
            // Fallback: use position value if world transform fails
            wPos = [L.position.value[0], L.position.value[1], 0];
        }

        layersMeta.push({
            originalIndex: L.index, 
            storedWorldPos: wPos,
            is3D: L.threeDLayer
        });
    }

    // Determine target position for the Null (based on the lead layer)
    var nullTargetPos = layersMeta[0].storedWorldPos;

    // -----------------------------------------------------
    // 2. Create Null (Created at Index 1 by default)
    // -----------------------------------------------------
    
    // Deselect all to prevent interference
    for (var i = 0; i < sel.length; i++) sel[i].selected = false;

    var nullLayer = comp.layers.addNull();
    nullLayer.name = leadLayer.name + " Control";
    nullLayer.inPoint = minIn;
    nullLayer.outPoint = maxOut;
    
    if (globalHas3D) nullLayer.threeDLayer = true;

    // Set Null position
    if (nullLayer.threeDLayer) {
        nullLayer.position.setValue(nullTargetPos);
    } else {
        nullLayer.position.setValue([nullTargetPos[0], nullTargetPos[1]]);
    }

    // -----------------------------------------------------
    // 3. PARENTING (While Null is stable at the top)
    // -----------------------------------------------------
    
    // Since Null was added at Index 1, all original indices shifted by +1.
    
    for (var k = 0; k < layersMeta.length; k++) {
        try {
            var meta = layersMeta[k];
            
            // Locate the layer using its new index
            var targetIndex = meta.originalIndex + 1;
            var targetLayer = comp.layer(targetIndex);

            // Parent the layer
            targetLayer.parent = nullLayer;

            // Compensate position (safe now as Null and Layer are stable)
            // Calculate new local position relative to the Null
            var newLocalPos = nullLayer.fromWorld(meta.storedWorldPos);

            if (targetLayer.threeDLayer) {
                targetLayer.position.setValue(newLocalPos);
            } else {
                targetLayer.position.setValue([newLocalPos[0], newLocalPos[1]]);
            }
        } catch(e) {
            // If a specific layer fails, skip it and proceed with others
            continue; 
        }
    }

    // -----------------------------------------------------
    // 4. MOVE NULL (Final Step)
    // -----------------------------------------------------
    
    // We need to move the Null directly ABOVE the lead layer.
    // The Lead Layer is now at: leadIndexOriginal + 1
    
    var currentLeadIndex = leadIndexOriginal + 1;
    var currentLeadLayer = comp.layer(currentLeadIndex);
    
    // Move the Null
    nullLayer.moveBefore(currentLeadLayer);

    // Select only the new Null
    nullLayer.selected = true;

    app.endUndoGroup();
})();