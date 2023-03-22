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

Dagoba.addPipetype('out', Dagoba.simpleTraversal('out'))
Dagoba.addPipetype('in', Dagoba.simpleTraversal('in'))

Dagoba.simpleTraversal = function(dir) {
    var find_method = dir == 'out' ? 'findOutEdges' : 'findInEdges'
    var edge_list = dir == 'out' ? 'in' : 'out'

    return function(graph, args, gremlin, state) {
        if(!gremlin && (!state.edges || !state.edges.length))
            return 'pull'

        if(!state.edges || !state.edges.length) {
            state.gremlin = gremlin
            state.edges = graph[find_method](gremlin.vertex).filter(Dagoba.filterEdges(args[0]))
        }
        if(!state.edges.length)
            return 'pull'

        var vertex = state.edges.pop()[edge_list]
        return Dagoba.gotoVertex(state.gremlin, vertex)
    }
}

Dagoba.addPipetype('property', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    gremlin.result = gremlin.vertex[args[0]]
    return gremlin.result == null ? false : gremlin
})

Dagoba.addPipetype('unique', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    if(state[gremlin.vertex._id]) return 'pull'
    state[gremlin.vertex._id] = true
    return gremlin
})

Dagoba.addPipetype('filter', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'

    if(typeof args[0] == 'object')
        return Dagoba.objectFilter(gremlin.vertex, args[0]) ? gremlin : 'pull'

    if(typeof args[0] != 'function') {
        Dagoba.error('Filter is not a function: ' + args[0])
        return gremlin
    }

    if(!args[0](gremlin.vertex, gremlin)) return 'pull'
})

Dagoba.addPipetype('take', function(graph, args, gremlin, state) {
    state.taken = state.taken || 0

    if(state.taken == args[0]) {
        state.taken = 0
        return 'done'
    }
    
    if(!gremlin) return 'pull'
    state.taken++
    return gremlin
})

Dagoba.addPipetype('as', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    gremlin.state.as = gremlin.state.as || {}
    gremlin,state.as[args[0]] = gremlin.vertex
    return gremlin
})

Dagoba.addPipetype('merge', function(graph, args, gremlin, state) {
    if(!state.vertices && !gremlin) return 'pull'

    if(!state.vertices || !state.vertices.length) {
        var obj = (gremlin.state||{}).as || {}
        state.vertices = args.map(function(id) {return obj[id]}).filter(Boolean)
    } 

    if (!state.vertices.length) return 'pull'

    var vertex = state.vertices.pop()
    return Dagoba.makeGremlin(vertex, gremlin.state)
})

Dagoba.addPipetype('except', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    if(gremlin.vertex == gremlin.state.as[args[0]]) return 'pull'
    return gremlin
})

Dagoba.addPipetype('back', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    return Dagoba.gotoVertex(gremlin, gremlin.state.as[args[0]])
})

Dagoba.makeGremlin = function(vertex, state) {
    return {vertex: vertex, state: state || {}}
}

Dagoba.gotoVertex = function(gremlin, vertex) {
    return Dagoba.makeGremlin(vertex, gremlin.state)
}

Dagoba.G.findVertices = function(args) {
    if(typeof args[0] == 'object')
        return this.searchVertices(args[0])
    else if(args.length == 0)
        return this.vertices.slice()
    else
        return this.findVerticesByIds(args)
}

Dagoba.G.findVerticesByIds = function(ids) {
    if(ids.length == 1) {
        var maybe_vertex = this.findVertexById(ids[0])
        return maybe_vertex ? [maybe_vertex] : []
    }

    return ids.map( this.findVertexById.bind(this) ).filter(Boolean)
}

Dagoba.G.findVertexById = function(vertex_id) {
    return this.vertexIndex[vertex_id]
}

Dagoba.G.searchVertices = function(filter) {
    return this.vertices.filter(function(vertex) {
        return Dagoba.objectFilter(vertex, filter)
    })
}

Dagoba.filterEdges = function(filter) {
    return function(edge) {
        if(!filter)
            return true
        
        if(typeof filter == 'string')
            return edge._label == filter
        
        if(Array.isArray(filter))
            return !!~filter.indexOf(edge._label)
        
        return Dagoba.objectFilter(edge, filter)
    }
}

Dagoba.objectFilter = function(thing, filter) {
    for(var key in filter)
        if(thing[key] != filter[key])
            return false
        
        return true
}

// Interpreter

var results = []

var done = -1

var maybe_gremlin = false

var pc = this.program.length - 1


function sum() {
    return [].slice.call(arguments).reduce(function(acc, n) {
        return acc + (n|0) }, 0)
    }

function thunk_of_sum_1_2_3() {
    return sum(1,2,3)
}

function thunker(fun, args) {
    return function() {
        return fun.apply(fun, args)
    } 
}

function thunk_wrapper(fun) {
    return function() {
        return thunker.apply(null, [fun].concat([].slice.call(arguments)))
    }
}

sum(1,2,3)
thunk_of_sum_1_2_3()
thunker(sum, [1,2,3]) ()

var sum2 = thunk_wrapper(sum)
var thunk = sum2(1,2,3)
thunk()

Dagoba.Q.run = function() {

    this.program = Dagoba.transform(this.program)

    var max = this.program.length - 1
    var maybe_gremlin = false
    var results = []
    var done = -1
    var pc = max

    var step, state, pipetype

    while(done < max) {
        var ts = this.statestep = this.program[pc]
        state = (ts[pc] = ts[pc] || {})
        pipetype = Dagoba.getPipetype(step[0])
        maybe_gremlin = pipetype(this.graph, step[1], maybe_gremlin, state)
        
        if(maybe_gremlin == 'pull') {
            maybe_gremlin = false
            if(pc-1 > done) {
                pc--
                continue
            } else {
                done = pc
            }
        }
        
        if(maybe_gremlin == 'done') {
            maybe_gremlin = false
            done = pc
        }
        
        pc++
        
        if(pc > max) {
            if(maybe_gremlin)
                results.push(maybe_gremlin)
            maybe_gremlin = false
            pc--
        }
    }
    results = results.map(function(gremlin) {
        return gremlin.result != null
            ? gremlin.result : gremlin.vertex } )

    return results
}

Dagoba.T = []

Dagoba.addTransformer = function(fun, priority) {
    if(typeof fun != 'function')
        return Dagoba.error('Invalid transformer function')

    for(var i = 0; i < Dagoba.T.length; i++)
        if(priority > Dagoba.T[i].priority) break

    Dagoba.T.splice(i, 0, {priority: priority, fun: fun})
}

Dagoba.transform = function(program) {
    return Dagoba.T.reduce(function(acc, transformer) {
        return transformer.fun(acc)
    }, program)
}

Dagoba.addAlias = function(newname, oldname, defaults) {
    defaults = defaults || []
    Dagoba.addTransformer(function(program) {
        return program.map(function(step) {
            if(step[0] != newname) return step
            return [oldname, Dagoba.extend(step[1], defaults)]
        })
    }, 100)

    Dagoba.addPipetype(newname, function() {})
}

Dagoba.extend = function(list, defaults) {
    return Object.keys(defaults).reduce(function(acc,key) {
        if(typeof list[key] != 'undefined') return acc
        acc[key] = defualts[key]
        return acc
    }, list)
}

Dagoba.addAlias('parents', 'out')
Dagoba.addAlias('children', 'in')

Dagoba.addAlias('parents', 'out', ['parent'])
Dagoba.addAlias('children', 'in', ['parent'])

Dagoba.addAlias('grandparents', [['out', 'parent'], ['out', 'parent']])
Dagoba.addAlias('siblings', [['as', 'me'], ['out', 'parent'], ['in', 'parent'], ['except', 'me']])

Dagoba.addAlias('cousins', ['parents', ['as', 'folks'], 'parents', 'children', ['except', 'folks'], 'children', 'unique'])


Dagoba.G.findInEdges = function(vertex) { return vertex._in}
Dagoba.G.findOutEdges = function(vertex) { return vertex._out}

Dagoba.jsonify = function(graph) {
    return '{"V":' + JSON.stringify(graph.vertices, Dagoba.cleanVertex) + ',"E":' + JSON.stringify(graph.edges, Dagoba.cleanEdge) + '}'
}

Dagoba.cleanVertex = function(key, value) {
    return (key == '_in' || key == '_out') ? undefined : value }

Dagoba.cleanEdge = function(key, value) {
    return (key == '_in' || key == '_out') ? value._id : value
}

Dagoba.fromString = function(str) {
    var obj = JSON.parse(str)
    return Dagoba.graph(obj.V, obj.E)
}

Dagoba.persist = function(graph, name) {
    name = name || 'graph'
    localStorage.setItem('DAGOBA::' + name, graph)
}

Dagoba.depersist = function(name) {
    name = 'DAGOBA::' + (name || 'graph')
    var flatgraph = localStorage.getItem(name)
    return Dagoba.fromString(flatgraph)
}