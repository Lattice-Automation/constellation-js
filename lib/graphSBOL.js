if (typeof window === 'undefined') {
  SBOLDocument = require('sboljs');
  graph = require('./graph');
}

//default values if annotation cannot be found in the SBOL
const MAX_CYCLE = 0;
const NUM_DESIGNS = 100;

const OPERATOR_URIS = {
  'http://sbols.org/v2#zeroOrMore': graph.ZERO_MORE,
  'http://sbols.org/v2#one': graph.ONE,
  'http://sbols.org/v2#oneOrMore': graph.ONE_MORE
};

/**
 * Generates graph based on combinatorial SBOL
 * @param sbol {SBOLDocument}
 * @returns {{stateGraph: {}, paths: Array}}
 */
function createGraphFromSBOL(sbol) {

  let stateGraph = {};    // Stores currently generated edges
  let boundaryStack = []; // Stores connected nodes in an object. Leaf nodes are stored in object.leaves

  //parse out categories
  const categories = getCategories(sbol);
  if (Object.keys(categories).length === 0){
    return undefined;
  }

  //get custom attributes
  let rootCV = getRootCombinatorialDerivation(sbol);

  // keep minimum if duplicate annotation
  let numDesigns = getMinAnnotation(rootCV, "numDesigns");
  numDesigns = numDesigns? numDesigns:NUM_DESIGNS;
  let maxCycles = getMinAnnotation(rootCV, "maxCycles");
  maxCycles = maxCycles? maxCycles:MAX_CYCLE;

  //create graph
  recurseVariableComponents(rootCV, stateGraph, boundaryStack);
  graph.addAcceptNodes(stateGraph, boundaryStack);

  // Get root of whole graph
  const root = graph.generateRootNode(stateGraph, boundaryStack);

  // Generate all paths
  const paths = graph.enumeratePaths(root, stateGraph, maxCycles);

  return {stateGraph, paths, categories, numDesigns};
}

function getMinAnnotation(rootCV, annotation){
  let annotations = rootCV.getAnnotations(annotation);
  if (!annotations || annotations.length === 0){
    return undefined;
  }

  let min = 0;
  for(let a of annotations){
    min = Math.min(min, Number.parseInt(a));
  }

  return min;
}

/**
 * @param combinatorialDerivation {CombinatorialDerivation}
 * @param stateGraph
 * @param boundaryStack
 */
function recurseVariableComponents(combinatorialDerivation, stateGraph, boundaryStack){
  let sortedVCs = sortVariableComponents(combinatorialDerivation);

  for(let v=0; v<sortedVCs.length; v++){

    const variableComponent = sortedVCs[v];
    const variantDerivs = variableComponent.variantDerivations;
    const collections = variableComponent.variantCollections;
    const hasVariants = collections.length > 0;

    //handle structure for just repeats
    if (variantDerivs.length === 1 && !hasVariants){
      for (let cv of variantDerivs) {
        recurseVariableComponents(cv, stateGraph, boundaryStack);
        graph.handleOp(OPERATOR_URIS[variableComponent.operator], stateGraph, boundaryStack);
      }
    }

    // handle ORs
    // else if (variantDerivs.length > 0) {
    else {

      for(let c=0; c<collections.length; c++){
      // for (let c of collections){
        graph.handleAtom([collections[c].displayId], stateGraph, boundaryStack);

        // OR if there is more than one collection
        if (c > 0 && boundaryStack.length > 1){
          graph.handleOp(graph.OR, stateGraph, boundaryStack);
        }
      }

      for(let i=0; i<variantDerivs.length; i++){
        recurseVariableComponents(variantDerivs[i], stateGraph, boundaryStack);

        // apply OR within the same VD or with variant (for collapsed OR)
        if (i > 0 || hasVariants){
          graph.handleOp(graph.OR, stateGraph, boundaryStack);
        }
      }

      graph.handleOp(OPERATOR_URIS[variableComponent.operator], stateGraph, boundaryStack);
    }

    // apply THEN within the same Combinatorial Derivation
    if (v > 0 && boundaryStack.length > 1){
      graph.handleOp(graph.THEN, stateGraph, boundaryStack);
    }

  }
}

/**
 * Return sorted components by sequence constraints
 * @param combinatorialDerivation {CombinatorialDerivation}
 */
function sortVariableComponents(combinatorialDerivation){
  let orderedComponents = [];
  //make ordered components from sequence constraints
  let seqConstraints = combinatorialDerivation.template.sequenceConstraints;
  for (let constraint of seqConstraints){
    let subject = constraint.subject;
    let object = constraint.object;
    //subject precedes object
    let subIndex = orderedComponents.indexOf(subject);
    let objIndex = orderedComponents.indexOf(object);
    // if neither are found
    if (subIndex === -1 && objIndex === -1){
      orderedComponents.push(subject);
      orderedComponents.push(object);
    } else if(subIndex > -1){ //if subject is found, put object after it
      orderedComponents.splice(subIndex+1, 0, object);
    }else if(objIndex > -1){ //if obj is found, put subject before it
      orderedComponents.splice(objIndex, 0, subject);
    }
  }

  //order variable components based on components array
  let orderedVCs = [];
  let variableComponents = combinatorialDerivation.variableComponents;
  for (let vc of variableComponents){
    let index = orderedComponents.indexOf(vc.variable);
    orderedVCs.splice(index, 0, vc);
  }

  return orderedVCs;
}

/**
 * Get the Combinatorial Derivation that isn't referred to
 * by any other Variant Derivations
 * @param sbol {SBOLDocument}
 */
function getRootCombinatorialDerivation(sbol){
  let derivations = sbol.combinatorialDerivations;
  for (let combDerivation of sbol.combinatorialDerivations) {
    for (let vc of combDerivation.variableComponents){
      derivations = derivations.filter((element) => !vc.variantDerivations.includes(element));
    }
  }
  return derivations[0];
}

/**
 * Parse categories from SBOL collections
 * @param sbol {SBOLDocument}
 * @returns {{}}
 */
function getCategories(sbol){
  let categories = {};
  for (let collection of sbol.collections){
    let members = [];
    for (let member of collection.members){
      members.push(member.displayId);
    }
    categories[collection.displayId] = members;
  }
  return categories;
}

// /**
//  * Get all roles associated with a list of Collections
//  * @param collections {Collection []}
//  * @param roles {Set}
//  */
// function getCollectionsRoles(collections, roles){
//   for (let c of collections){
//     for (let v of variants){
//       for (let r of v.roles){
//         let soURL = 'http://' + r._parts.hostname + r._parts.path;
//         role = Object.keys(SBOLDocument.terms).find(key => SBOLDocument.terms[key] === soURL);
//         roles.add(role);
//       }
//     }
//   }
// }

if (typeof window === 'undefined') {
  module.exports = createGraphFromSBOL;
}

