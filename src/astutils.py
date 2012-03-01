'''
Created on Feb 6, 2012
Last updated on Feb 10, 2012

@author: Ivan Gozali

module astutils

A module to work with ASTs generated by pynarcissus. This module contains
several functions to traverse the AST, and also generating ASTs from JavaScript
files.

For details on how to use the functions listed below, please go to the functions
themselves or consult README.txt.

List of functions:
-    create_AST(js_path)
-    create_AST_from_string(string)
-    traverse_AST(node, fn, postfn)
-    traverse_AST_level(node, fn, postfn, level)
-    is_node_type(node, nodetype)
'''

import os
import pynarcissus.jsparser
import fileutils

def create_AST(js_path):
    """
    Returns the AST corresponding to the JavaScript file specified as js_path.
    js_path can be relative or absolute.
    """
    
    if os.path.exists(js_path):
        js_file = fileutils.convert_abs_to_rel(js_path)
    else:
        return "File does not exist."
    
    if fileutils.is_javascript_file(js_file):
        return pynarcissus.jsparser.parse(open(js_path, "r").read(), js_file)


def create_AST_from_string(string):
    """
    Returns the AST corresponding to the JavaScript file specified as js_path.
    js_path can be relative or absolute.
    """
    return pynarcissus.jsparser.parse(string, "fromString.js")


def traverse_AST(node, fn=None, postfn=None):
    """
    Traverses the whole AST passed in as node, and applies the function fn
    to each node.
    
    This function WILL NOT TRAVERSE THE varDecls attribute of the AST, because
    the varDecls attribute is of type list, and as such does not get included.
    
    If we call count_nodes on the AST, the result will be the number of nodes 
    in the AST minus the number of nodes in the AST's varDecl.
    
    node       - The head node of the AST
    fn         - Function that will be applied when a new recursive depth is
                 entered (pre-order).
    postfn     - Function that will be applied when the current recursive depth
                 is completed (post-order)
    """
    if callable(fn):
        fn(node)
    
    # If the current node has a list, then the elements of the list
    # will be of type jsparser.Node. Traverse all of them.
    if len(node) != 0:
        for elem in node:
            traverse_AST(elem, fn, postfn)
    
    # Regardless of whether it has a list, it might contain a 
    # body or expression attribute. Try to look for them also.
    for key in node.__dict__.keys():
        attr = getattr(node, str(key))
        
        # Special handling for looping statements, otherwise it 
        # will recurse infinitely (especially the CONTINUE statement)
        if key == "target":
            continue
        
        if type(attr) == pynarcissus.jsparser.Node:
            traverse_AST(attr, fn, postfn)

    if callable(postfn):
        postfn(node)


def traverse_AST_level(node, fn=None, postfn=None, level=0):
    """
    Similar to traverse_AST, except this traverse function keeps track
    of the current recursive depth.
    
    The functions that are used as fn and postfn must have the signature:
    
        fn(node, level)
        postfn(node, level)
    
    where node is an AST node generated by pynarcissus, and level is the
    recursive depth.
    
    node       - The head node of the AST
    fn         - Function that will be applied when a new recursive depth is
                 entered (pre-order).
    postfn     - Function that will be applied when the current recursive depth
                 is completed (post-order)
    level      - Current recursion level.
    """
    if callable(fn):
        fn(node, level)
    
    # If the current node has a list, then the elements of the list
    # will be of type jsparser.Node. Traverse all of them.
    if len(node) != 0:
        for elem in node:
            traverse_AST_level(elem, fn, postfn, level+1)
    
    # Regardless of whether it has a list, it might contain a 
    # body or expression attribute. Try to look for them also.
    for key in node.__dict__.keys():
        attr = getattr(node, str(key))
        
        # Special handling for looping statements, otherwise it 
        # will recurse infinitely (especially the CONTINUE statement)
        if key == "target":
            continue
        
        if type(attr) == pynarcissus.jsparser.Node:
            traverse_AST_level(attr, fn, postfn, level+1)

    if callable(postfn):
        postfn(node, level)


def is_node_type(node, nodetype):
    """
    Returns True if the AST node in node is of the specified type nodetype.
    
    node        - pynarcissus AST node
    nodetype    - a string that specifies the node type (e.g. "ASSIGN", "VAR")
                  or an iterable of strings that specify node type
    """
    assert type(nodetype) in (str, list, tuple), "nodetype is not of type str/list/tuple"
    
    if type(nodetype) == str:
        if getattr(node, "type", None) == nodetype:
            return True
        return False
    else:
        if getattr(node, "type", None) in nodetype:
            return True
        return False


def get_node_list(headnode, nodetype):
    """
    Returns a list of AST nodes (references, not copies) whose type is nodetype.
    
    headnode    - the head node of the AST
    nodetype    - a string that specifies the node type (e.g. "ASSIGN", "VAR")
                  or an iterable of strings that specify node type
    """
    node_list = []
    
    def get_node(node):
        if is_node_type(node, nodetype):
            node_list.append(node)
    
    traverse_AST(headnode, get_node)
    return node_list

NODE_TYPES = ["SEMICOLON", "COMMA", "HOOK", "COLON", "OR", "AND",
              "BITWISE_OR", "BITWISE_XOR", "BITWISE_AND", "STRICT_EQ",
              "EQ", "ASSIGN", "STRICT_NE", "NE", "LSH", "LE", "LT",
              "URSH", "RSH", "GE", "GT", "INCREMENT", "DECREMENT",
              "PLUS", "MINUS", "MUL", "DIV", "MOD", "NOT", "BITWISE_NOT",
              "DOT", 
              
              "RETURN", "FUNCTION", "VAR"]

#BINARY_OPS = ["OR", "AND", "BITWISE_OR", "BITWISE_AND", "STRICT_EQ", 
#              "EQ", "STRICT_NE", "NE", "LSH", "LE", "LT", "URSH", "RSH",
#              "GE", "GT", "PLUS", "MINUS", "MUL", "DIV", "MOD", "DOT"]
#BINARY_TOKENS = []

UNARY_OPS = ["INCREMENT", "DECREMENT", "NOT", "BITWISE_NOT"]
NODE_TOKENS = [";", ",","?",":","||","&&","|","^","&","===","==","=","!==","!=",
               "<<","<=","<",">>>",">>",">=",">","++","--","+","-","*","/","%","!","~",".",
               
               "return","function",":="]

OPERATOR_DICT = dict()
for i in range(len(NODE_TYPES)):
    OPERATOR_DICT[NODE_TYPES[i]] = NODE_TOKENS[i]

def construct_expression(node):
    """
    Given a dot node or a call node, attempts to construct the string representation
    from the AST.
    """
    if is_node_type(node, NODE_TYPES):
        return str(construct_expression(node[0])) + " " + OPERATOR_DICT[node.type] + " " + str(construct_expression(node[1]))
    if is_node_type(node, "CALL"):
        argstr = ""
        if len(node[1]) > 0:
            for arg in node[1]:
                argstr += ","#str(construct_expression(arg)) + ", "
            argstr = argstr[:-2]
        return str(construct_expression(node[0])) + "(" + argstr + ")"
    if is_node_type(node, "INDEX"):
        return str(construct_expression(node[0])) + "[" + str(construct_expression(node[1]))+ "]"
    return str(node.value)

    
    