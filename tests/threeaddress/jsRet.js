function localVars(x,y) {
    var a = 6;

    function innerVars() {
        var a = 10;
        b = a;
    }

    var b = 7;

    function innerVars2() {
        var c = 11;
        var d = b;
    }

    innerVars();
    return b
}

localVars(3,4);

function secondFunc(x) { 
    var inSec = 60;
    var a = inSec;
    var b = a;
    for(var i = 0; i < 10; i++){
          var p = 5;
    }
}

secondFunc(5)

for(var x in unknown){
    var p = x;
}

