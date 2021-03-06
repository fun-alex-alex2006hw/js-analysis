/*
Test for nested function declarations for threeaddress.py.

Should output:

    Function(name:__global__, parent:None)
    - a := function([]){...}
    - b := function([]){...}
    ----------------------------------------

    Function(name:a, parent:__global__)
    - b := function([]){...}
    - c := function([]){...}
    - varOne := 5
    - return 6
    ----------------------------------------

    Function(name:b, parent:a)
    - return null
    ----------------------------------------

    Function(name:c, parent:a)
    - return 8
    ----------------------------------------

    Function(name:b, parent:__global__)
    - varTwo := 6
    - varThree := 7
    ----------------------------------------

*/

function a(){
    function b(){
        return;
    }
    function c(){
        return 8;
    }
    var varOne = 5;
    return 6;
}

function b(){
    var varTwo = 6;
    var varThree = 7;
}