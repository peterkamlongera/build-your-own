// V = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
// E = [[1,2], [1,3], [2,4], [2,5], [3,6], [3,7], [4,8], [4,9], [5,10], [5,11], [6,12], [6,13], [7,14], [7,15]]

// parents = function(vertices) {
//     var accumulator = []
//     for(var i =0; i < E.length; i++) {
//         var edge = E[i]
//         if(vertices.indexOf(edge[1]) !== -1)
//             accumulator.push(edge[0])
//     }
// }

// parents = (vertices) => E.reduce(
//     (acc, [parent, child]) => vertices.includes(child) ? acc.concat(parent) : acc , []
// )

// children = (vertices) => E.reduce(
//     (acc, [parent, child]) => vertices.includes(parent) ? acc.concat(child) : acc , []
// )

// parents = function(x) {
//     return E.reduce(
//         function(acc, e) {
//             return ~x.indexOf(e[1]) ? acc.concat(e[0]) : acc
//         }, []
//     )
// }

// children = function(x) { 
//     return E.reduce(
//         function(acc, e) {
//             return ~x.indexOf(e[0]) ? acc.concat(e[1]) : acc
//         }, []
//     )
// }

Dagoba.G = {}

Dagoba.graph = function(V, E) {
    var graph = Object.create( Dagoba.G)

    graph.edges = []
    graph.vertices = []
    graph.vertexIndex = {}

    graph.autoid = 1

    if(Array.isArray(V)) graph.addVertices(V)
    if(Array.isArray(E)) graph.addEges(E)

    return graph
}

Dagoba.G.addVertices = function(vs) {
    vs.forEach(this.addVertex.bind(this))
}

Dagoba.G.addEdges = function(es) {
    es.forEach(this.addEdge.bind(this))
}

Dagoba.G.addVertex = function(vertex) {
    if(!vertex._id)
        vertex._id = this.autoid++
    else if (this.findVertexById(vertex._id))
        return Dagoba.error('A vertex with that ID already exists')

    this.vertices.push(vertex)
    this.vertexIndex[vertex._id] = vertex
    vertex._out = []; vertex._in = []
    return vertex._id    
}

Dagoba.G.addEdge = function(edge) {
    edge._in = this.findVertexById(edge._in)
    edge._out = this.findVertexById(edge._out)

    if(!(edge._in && edge._out))
    return Dagoba.error("That edge's" + (edge._in ? 'out' : 'in') + "vertex wasn't found")

    edge._out._out.push(edge)
    edge._in._in.push(edge)

    this.edges.push(edge)
}

Dagoba.error = function(msg) {
    console.log(msg)
    return false
}

Dagoba.Q = {}

Dagoba.query = function(graph) {
    var query = Object.create ( Dagoba.Q )

    query.graph = graph
    query.state = []
    query.program = []
    query.gremlins = []

    return query
}

Dagoba.Q.add = function(pipetype, args) {
    var step = [pipetype, args]
    this.program.push(step)
    return this
}

Dagoba.G.v = function() {
    var query = Dagoba.query(this)
    query.add('vertex', [].slice.call(arguments))
    return query
}

Dagoba.Pipetypes = {}

Dagoba.addPipetype = function(name, fun) {
    Dagoba.Pipetypes[name] = fun
    Dagoba.Q[name] = function() {
        return this.add(name, [].slice.apply(arguments))
    }
}

Dagoba.getPipetype = function(name) {
    var pipetype = Dagoba.Pipetypes[name]

    if(!pipetype)
        Dagoba.error('Unrecognized pipetype:' + name)

    return pipetype || Dagoba.fauxPipetype
}

Dagoba.fauxPipetype = function(_, _, maybe_gremlin) {
    return maybe_gremlin || 'pull'
}

Dagoba.addPipetype('vertex', function(graph, args, gremlin, state) {
    if(!state.vertices)
        state.vertices = graph.findVertices(args)
    
    if(!state.vertices.length)
        return 'done'

    var vertex = state.vertices.pop()
    return Dagoba.makeGremlin(vertex, gremlin.state)  
})