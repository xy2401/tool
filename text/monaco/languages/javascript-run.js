const paragraph = "The quick brown fox jumps over the lazy dog. It barked.";
const regex = /[A-Z]/g;
const found = paragraph.match(regex);

function greet(name) {
  return `Hello, ${name}!`;
}

console.log(found);
console.log(greet("World"));
console.log("1 + 1 =", 1 + 1);
