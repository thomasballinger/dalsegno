'use strict';

/** Returns a more fancily formatted error message */
function humanize(e){
  var s = ''+e;
  if (/expected newline between expressions/.test(s)){
    return ("Error: more than one expression found on a line." +
            "\n\nMaybe you should split this into two lines?");
  } else if (/Error: Name/.test(s)){
    var name = s.match(/Error: Name (\S+)/)[1].slice(1, -1);
    var parts = s.match(/[<]Environment\n([\s\S]+)with runner/);
    var scopes = parts[1].split('\n');
    var names = [].concat.apply([], scopes.map((line)=>line.split(','))).filter((word)=>word.length > 0);
    console.log('here are the names:');
    console.log(names);
    var index = 'not found in.*';
    //slurp up all the names in all namespaces and suggest things with small edit distance
    //
    var suggs = suggestions(name, names);
    console.log('suggestions:', suggs);
    var suggestionString;
    if (suggs.length === 1){
      suggestionString = `\nDid you mean ${suggs[0]}?`;
    } else if (suggs.length > 1){
      var last = suggs.pop();
      suggestionString = `\nDid you mean ${suggs.join(', ')} or ${last}?`;
    } else {
      suggestionString = '';
    }
    return `Error: I don't know what ${name} is.\n` + suggestionString;
  }
  console.log(e);
  return s;
}


function suggestions(cur, possible){
  var maxDist = 3;
  var maxSugg = 3;
  var sortedStuff = sorted(possible
    .map(poss => [levenshtein(cur, poss), poss]), poss => poss[0]);
  sortedStuff = possible.slice(0);
  sortedStuff.sort();
  console.log('alphabetical:', sortedStuff);

  return sorted(possible
    .map(poss => [levenshtein(cur, poss), poss])
    .filter(poss => poss[0] < maxDist),
    poss => poss[0])
    .map(poss => poss[1])
    .slice(0, maxSugg);
}

/** like python's range, inclusive at the start and inclusive at the end */
function range(start, end){
  if (start === undefined){
    throw Error("Range requires 1 or 2 args");
  }
  if (end === undefined){
    end = start;
    start = 0;
  }
  var l = [];
  for (var i=start; i<end; i++){
    l.push(i);
  }
  return l;
}

/** like Python's sorted, returns a new array sorted by key */
function sorted(arr, key){
  var newArr = arr.slice(0);
  var cmp;
  if (key === undefined){
    cmp = (a, b) => a - b;
  } else {
    cmp = (a, b) => key(a) - key(b);
  }
  newArr.sort(cmp);
  return newArr;
}

var levenshtein = function(s, t) {
    var d = []; //2d matrix

    // Step 1
    var n = s.length;
    var m = t.length;

    if (n == 0) return m;
    if (m == 0) return n;

    //Create an array of arrays in javascript (a descending loop is quicker)
    for (var i = n; i >= 0; i--) d[i] = [];

    // Step 2
    for (var i = n; i >= 0; i--) d[i][0] = i;
    for (var j = m; j >= 0; j--) d[0][j] = j;

    // Step 3
    for (var i = 1; i <= n; i++) {
        var s_i = s.charAt(i - 1);

        // Step 4
        for (var j = 1; j <= m; j++) {

            //Check the jagged ld total so far
            if (i == j && d[i][j] > 4) return n;

            var t_j = t.charAt(j - 1);
            var cost = (s_i == t_j) ? 0 : 1; // Step 5

            //Calculate the minimum
            var mi = d[i - 1][j] + 1;
            var b = d[i][j - 1] + 1;
            var c = d[i - 1][j - 1] + cost;

            if (b < mi) mi = b;
            if (c < mi) mi = c;

            d[i][j] = mi; // Step 6

            //Damerau transposition
            if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
            }
        }
    }

    // Step 7
    return d[n][m];
}
function levenshtein2(a, b){
  if (a.length === 0 || b.length === 0){
    throw new Error('bad input to levenshtein: "'+a+'", "'+b+'"');
  }
  [a, b] = sorted([a, b], x => x.length);
  console.log(a, b);
  // now a is shorter than or the same length as b

  var row = range(a.length);

  // fill in the rest
  for (var i of range(1, b.length+1)){
    var prev = i;
    for (var j of range(1, a.length+1)){
      var val;
      if (b.charAt(i-1) == a.charAt(j-1)){
        val = row[j-1]; // match
      } else {
        val = Math.min(row[j-1] + 1, // substitution
                       prev + 1,     // insertion
                       row[j] + 1);  // deletion
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }

  return row[a.length];
}

humanize.humanize = humanize;
humanize.sorted = sorted;
humanize.range = range;
humanize.levenshtein = levenshtein;
module.exports = humanize;
