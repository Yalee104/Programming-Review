# Python Syntax & Techniques — Study Summary

## 1. Dynamic Typing & Duck Typing

**What it means:** in Python, a variable is just a NAME (a label) bound to an object living somewhere in memory. The name itself has no type — the object does. So the same name can be rebound to a completely different type of object at any time, and Python will never complain about it.

```python
x = 5
print(type(x), x)      # <class 'int'> 5
x = "hello"              # same name x, rebound to a totally different type
print(type(x), x)          # <class 'str'> hello
x = [1, 2, 3]
print(type(x), x)            # <class 'list'> [1, 2, 3]
```
✅ OK: rebinding `x` to `int`, then `str`, then `list` all work — there's no compile-time type to violate.

**Duck typing** means: a function doesn't check *what type* its argument is, it just tries to use it, and Python checks — at the moment of use, not before — whether the object actually supports that operation. ("If it walks like a duck and quacks like a duck, it's a duck" — no declared "duck" type required.)

```python
def describe(thing):
    return f"{thing!r} has length {len(thing)}"
```
✅ OK — anything that supports `len()` works, with zero declared interface:
```python
describe("abc")          # "'abc' has length 3"        -- str supports len()
describe([1, 2, 3, 4])     # "[1, 2, 3, 4] has length 4"  -- list supports len()
```
❌ ERROR — an `int` doesn't support `len()`, and Python only discovers this when the line actually executes, not before:
```python
describe(42)
# TypeError: object of type 'int' has no len()
```
This is the key contrast with C++: in C++ a type mismatch is usually caught by the COMPILER before the program ever runs; in Python it's only caught at RUNTIME, exactly at the point where the unsupported operation is attempted.

---

## 2. Mutable vs Immutable Types, Identity vs Equality

**What `is` means:** "are these two names pointing at the literally same object in memory?" **What `==` means:** "do these two objects have the same value?" Two different objects can be `==` without being `is`.

```python
a = [1, 2, 3]
b = a                  # b is NOT a copy -- it's another name for the EXACT SAME list object
b.append(4)
```
✅ OK, but probably surprising if you expected `b = a` to copy:
```python
a            # [1, 2, 3, 4]  -- a changed too! b.append(4) mutated the ONE list both names point to
a is b         # True -- same identity
c = [1, 2, 3, 4]
a == c           # True  -- equal VALUES
a is c             # False -- but NOT the same object -- verified
```

**What "mutable" means:** the object can be changed in place (its identity/`id()` stays the same, its contents change) — lists, dicts, sets, most custom objects. **What "immutable" means:** the object can never be changed in place — any "modification" actually builds a brand-new object and rebinds the name to it — int, float, str, tuple.

```python
s1 = "hello"
s2 = s1
s2 += " world"      # this does NOT mutate the string -- it builds a NEW string and rebinds s2 to it
```
✅ OK — proof that `s1` was never touched:
```python
s1           # "hello"        -- unchanged, verified
s2             # "hello world"
s1 is s2         # False -- different objects now, verified
```

**A common trap:** CPython caches small integers (-5 to 256) as a private implementation detail, so `is` can *look like* it works for comparing int values — but this is NOT a language guarantee, and it silently breaks for larger numbers:
```python
a = (lambda n: n * 2)(50)     # 100, computed at runtime (not a literal, so it can't be constant-folded)
b = (lambda n: n * 2)(50)
a is b                           # True -- small ints ARE cached by CPython -- verified

x2 = (lambda n: n * 2)(500)   # 1000, also runtime-computed
y2 = (lambda n: n * 2)(500)
x2 is y2                          # False -- verified, NOT cached -- two different objects
x2 == y2                             # True -- same VALUE, just not the same object
```
✅ Rule of thumb: **use `==` to compare values, always. Only use `is` to check identity (most commonly `x is None`).**

**The mutable-default-argument trap.** A default argument value is created exactly ONCE, when the `def` statement runs — not once per call. If that default is a mutable object like `[]`, every call that doesn't override it shares that SAME list.
```python
def append_item(item, bucket=[]):     # DANGER: this [] is built ONE time, at def-time
    bucket.append(item)
    return bucket
```
❌ Not an error, but almost certainly not what you want — the same list keeps growing across unrelated calls:
```python
append_item(1)   # [1]
append_item(2)     # [1, 2]    -- surprise! same list persisted from the FIRST call -- verified
append_item(3)       # [1, 2, 3]
```
✅ OK — the fix: default to `None`, and build a fresh mutable object INSIDE the function body every call:
```python
def append_item_fixed(item, bucket=None):
    if bucket is None:
        bucket = []       # a brand-new list, every single call
    bucket.append(item)
    return bucket

append_item_fixed(1)   # [1]  -- verified
append_item_fixed(2)     # [2]  -- correct, independent each time -- verified
```

Quick reference:
```
is    → identity (same object in memory) -- use for `x is None`, not general value comparisons
==    → equality (same value, possibly different objects) -- use this for comparing values
mutable types    → list, dict, set, most custom objects -- modified IN PLACE, aliasing is real
immutable types  → int, float, str, tuple, frozenset -- "changing" makes a brand NEW object
mutable default argument (def f(x=[]))  → built ONCE at def-time, shared across ALL calls that
                                           don't override it -- use x=None, then `if x is None: x = []`
```

---

## 3. Function Arguments — *args / **kwargs, Keyword-Only & Positional-Only

**What `*args` means:** collect any extra POSITIONAL arguments into a tuple named `args`. **What `**kwargs` means:** collect any extra KEYWORD arguments into a dict named `kwargs`.

```python
def summary(*args, **kwargs):
    print("args:", args)
    print("kwargs:", kwargs)
```
✅ OK:
```python
summary(1, 2, 3, name="Aaron", age=30)
# args: (1, 2, 3)
# kwargs: {'name': 'Aaron', 'age': 30}
```

The same `*`/`**` syntax also UNPACKS at a call site — the mirror image of collecting:
```python
def add3(a, b, c): return a + b + c

nums = [1, 2, 3]
add3(*nums)              # 6  -- *nums unpacks the list into 3 separate positional args -- verified

info = {"a": 10, "b": 20, "c": 30}
add3(**info)                # 60 -- **info unpacks the dict into keyword args matching param names -- verified
```

**What the bare `*` in a parameter list means:** everything listed AFTER it can ONLY be passed by keyword — never positionally, no matter what order you put them in.

```python
def connect(host, *, port=8080, timeout=30):
    return f"{host}:{port} (timeout={timeout})"
```
✅ OK — `host` is positional (before the `*`), `port`/`timeout` must be named:
```python
connect("localhost")                  # "localhost:8080 (timeout=30)"  -- verified
connect("localhost", port=9090)         # "localhost:9090 (timeout=30)" -- verified
```
❌ ERROR — trying to pass `port` positionally, as a second plain argument, fails because `connect` only accepts ONE positional argument (`host`):
```python
connect("localhost", 9090)
# TypeError: connect() takes 1 positional argument but 2 were given
```
This is exactly the case that's easy to get wrong: it looks like it should just be "the second argument," but the bare `*` locked the door on passing anything after it positionally.

**What the bare `/` in a parameter list means:** everything listed BEFORE it can ONLY be passed positionally — never by keyword, even if you use the exact right parameter name (Python 3.8+).

```python
def divide(a, b, /):
    return a / b
```
✅ OK — positional calls work fine:
```python
divide(10, 2)              # 5.0 -- verified
```
❌ ERROR — using the parameter names as keywords fails, even though `a` and `b` are the function's real parameter names:
```python
divide(a=10, b=2)
# TypeError: divide() got some positional-only arguments passed as keyword arguments: 'a, b'
```

Quick reference:
```
*args        → extra positional args, collected into a tuple
**kwargs       → extra keyword args, collected into a dict
*x / **x at a call site  → UNPACKS a list/dict into separate positional/keyword arguments
bare * in params            → everything AFTER must be passed by keyword (verified: positional call -> TypeError)
bare / in params               → everything BEFORE must be passed positionally (verified: keyword call -> TypeError)
```

---

## 4. Lambda — Anonymous Inline Functions

**What `lambda` means:** it's a way to write a small, unnamed function as a single EXPRESSION, usually right where you need it (as an argument to another function), instead of writing a full `def` elsewhere and giving it a name. `lambda parameters: expression` is equivalent to a function that takes those parameters and `return`s that one expression — nothing more.

```python
square = lambda x: x * x

# EXACTLY equivalent to:
def square_def(x):
    return x * x
```
✅ OK — verified, both produce identical results:
```python
square(5)        # 25 -- verified
square_def(5)       # 25 -- verified, same thing, just written two different ways
```

A lambda can take multiple parameters, default arguments, and even `*args`/`**kwargs` — everything a `def` can, EXCEPT it can only ever contain ONE expression:
```python
add = lambda a, b: a + b
greet = lambda name, greeting="hello": f"{greeting}, {name}"
collect = lambda *args, **kwargs: (args, kwargs)
```
✅ OK — all verified:
```python
add(2, 3)                      # 5
greet("Aaron")                    # "hello, Aaron"
greet("Aaron", "hi")                 # "hi, Aaron"
collect(1, 2, x=3)                      # ((1, 2), {'x': 3})
```

**The one hard restriction: a lambda's body must be a single EXPRESSION — never a statement.** Assignments (`x = 1`), `return`, `if`/multi-line blocks, and loops are all STATEMENTS in Python, and none of them are allowed inside a lambda.
```python
bad = lambda x: (y = x + 1)   # assignment is a STATEMENT
```
❌ ERROR — this is actually a `SyntaxError`, caught before the program even starts running:
```python
# SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?
```
❌ Likewise, `return` is a statement too, and is never allowed inside a lambda body:
```python
bad = lambda x: return x + 1
# SyntaxError: invalid syntax
```
✅ OK — but a CONDITIONAL EXPRESSION (`a if cond else b`) is fine, because — unlike an `if` statement/block — it's genuinely a single expression that evaluates to a value:
```python
classify = lambda x: "even" if x % 2 == 0 else "odd"
classify(4)   # "even" -- verified
classify(7)     # "odd"  -- verified
```

**Where lambdas actually get used — almost always passed INLINE as an argument**, most commonly as the `key=` for sorting, or with `map`/`filter`/`reduce`:
```python
names = ["Charlie", "alice", "Bob"]
sorted(names)                             # ['Bob', 'Charlie', 'alice'] -- verified, default sort is case-sensitive
sorted(names, key=lambda s: s.lower())      # ['alice', 'Bob', 'Charlie'] -- verified, sorts by the lowercase form

nums = [1, 2, 3, 4, 5, 6]
list(filter(lambda x: x % 2 == 0, nums))     # [2, 4, 6] -- verified, keeps only values the lambda returns True for
list(map(lambda x: x * x, nums))               # [1, 4, 9, 16, 25, 36] -- verified, transforms every value

import functools
functools.reduce(lambda acc, x: acc + x, nums)   # 21 -- verified, folds the whole sequence to one value
```

**Style note:** assigning a lambda to a plain variable name (`square = lambda x: x * x`, as shown at the very top of this section) works fine, but is discouraged by Python's own style guide (PEP 8) — if it's worth naming, it's worth writing as a real `def`, which also gives you a proper `__name__` for debugging and supports multiple statements if the function ever needs to grow. Running a linter on that exact line confirms this is an actual, official style rule, not just an opinion:
```
square = lambda x: x * x
# flake8: E731 do not assign a lambda expression, use a def
```
✅ Lambdas are best reserved for short, disposable, inline uses like the `sorted`/`filter`/`map`/`reduce` examples above — anywhere you'd otherwise need a name is a sign to use `def` instead.

⚠️ One more thing worth knowing now and seeing in full later: a lambda is a closure just like a nested `def` would be — it can read variables from its enclosing scope, which is exactly what causes the late-binding "loop variable" gotcha covered in detail in the Closures section below.

Quick reference:
```
lambda params: expr     → an anonymous function; equivalent to def f(params): return expr
lambda body                → must be exactly ONE expression -- no assignment, no return, no
                              if-statements/loops (verified: SyntaxError for any of those)
conditional expression        → `a if cond else b` IS allowed -- it's an expression, not a statement
*args/**kwargs in a lambda        → supported, exactly like in a def
most common use                     → passed INLINE as a one-off callback: sorted(key=...),
                                       filter(...), map(...), functools.reduce(...)
naming a lambda (x = lambda: ...)      → works, but PEP 8 discourages it (verified: flake8 E731) --
                                          use a real def instead if it's worth a name
lambda captures variables like a def     → closures apply to lambdas too (see Closures section)
```

---

## 5. Comprehensions & Generator Expressions

**What a list comprehension means:** `[expr for x in iterable if condition]` reads as "build a new list by computing `expr` for each `x` in `iterable`, skipping any `x` that fails `condition`." It's eager — the ENTIRE list is built immediately, in memory, before the line finishes.

```python
squares = [x*x for x in range(6)]
```
✅ OK — verified: `squares == [0, 1, 4, 9, 16, 25]`

```python
evens_squared = [x*x for x in range(10) if x % 2 == 0]
```
✅ OK — verified: `evens_squared == [0, 4, 16, 36, 64]` — the `if` clause filters BEFORE `x*x` is computed for that `x`.

The same syntax works for dicts and sets, just with `{}` instead of `[]`, and `key: value` for dicts:
```python
square_map = {x: x*x for x in range(5)}                       # {0:0, 1:1, 2:4, 3:9, 4:16} -- verified
unique_lengths = {len(w) for w in ["a", "bb", "cc", "ddd"]}      # {1, 2, 3} -- verified
```
⚠️ A related but different gotcha: `{}` alone is an empty DICT, not an empty set — you must write `set()` explicitly for an empty set:
```python
type({})       # <class 'dict'>  -- verified
type(set())      # <class 'set'>   -- verified
```

**Nested comprehensions** read left-to-right in the SAME order you'd write nested `for` loops:
```python
matrix = [[1, 2, 3], [4, 5, 6]]
flat = [v for row in matrix for v in row]
```
✅ OK — verified: `flat == [1, 2, 3, 4, 5, 6]` (equivalent to `for row in matrix: for v in row: collect v`)

**A comprehension has its OWN private scope in Python 3** — its loop variable does NOT leak into the surrounding scope, unlike a regular `for` loop, which DOES leak:
```python
x = "before"
squares = [x for x in range(3)]
```
✅ OK — verified: `x` is still `"before"` after the comprehension; the comprehension's `x` was local to it.
```python
y = "before"
for y in range(3):
    pass
```
⚠️ Contrast — verified: `y` is now `2` after the loop; a plain `for` loop's variable DOES leak into the enclosing scope, permanently overwriting `y`.

**Generator expressions — `(expr for x in it)` with round parens instead of square brackets — are LAZY**: nothing is computed until you explicitly ask for the next value, and the whole sequence never has to exist in memory at once.
```python
gen = (x*x for x in range(1000000))
gen                        # <generator object <genexpr> at 0x...>  -- just a paused object, no values yet
next(gen)                    # 0 -- computes ONLY the first value -- verified
next(gen)                      # 1 -- computes the next one, on demand -- verified
```
✅ OK — the size difference proves this isn't just a syntax preference:
```python
import sys
sys.getsizeof([x*x for x in range(100000)])   # 800984 bytes -- verified, the WHOLE list exists in memory
sys.getsizeof((x*x for x in range(100000)))     # 104 bytes    -- verified, tiny regardless of range size
```

Quick reference:
```
[expr for x in it if cond]   → list comprehension -- eager, builds the WHOLE list immediately
{expr for x in it}             → set comprehension -- same idea, deduplicated
{k: v for x in it}                → dict comprehension
(expr for x in it)                  → generator expression -- LAZY, one value at a time, tiny memory
{}                                     → empty DICT, not empty set (use set() for that)
comprehension loop variable               → private to the comprehension, does NOT leak (Python 3)
plain for-loop variable                     → DOES leak into the surrounding scope after the loop ends
```

---

## 6. Iterators & Generators

**What `yield` means:** put `yield` anywhere inside a function, and calling that function no longer runs its body at all — it instead returns a paused "generator" object immediately. Each call to `next()` on that generator resumes the body from exactly where it left off, runs until the next `yield`, and returns that value.

```python
def countdown(n):
    print(f"  starting countdown from {n}")
    while n > 0:
        yield n
        n -= 1
    print("  liftoff!")

gen = countdown(3)
```
✅ OK — verified step by step: calling `countdown(3)` prints NOTHING (the body hasn't run yet); each `next()` call runs a bit further:
```python
next(gen)    # prints "  starting countdown from 3", returns 3
next(gen)      # resumes right after yield, returns 2 -- (no re-print of "starting...")
next(gen)        # returns 1
```
❌ Once the function body finishes (falls off the end, or hits a `return`), calling `next()` one more time raises `StopIteration` rather than returning a value:
```python
next(gen)
# (prints "  liftoff!", then:)
# StopIteration
```

A `for` loop is exactly this pattern automated: it repeatedly calls `next()` and stops cleanly the moment it catches `StopIteration` (you never see that exception directly in a `for` loop):
```python
for val in countdown(3):
    print("for-loop got:", val)
```
✅ OK — verified output:
```
  starting countdown from 3
for-loop got: 3
for-loop got: 2
for-loop got: 1
  liftoff!
```

⚠️ **A generator can only be consumed ONCE.** Once exhausted, it stays exhausted — it does NOT reset:
```python
def gen3():
    yield 1
    yield 2

g = gen3()
list(g)   # [1, 2]  -- verified, consumes the whole generator
list(g)     # []      -- verified, ALREADY exhausted, nothing left to give
```
✅ To iterate again, you must call the generator FUNCTION again to get a brand-new generator object (`gen3()`, not reuse `g`).

**Because generators are lazy, they can safely be infinite** — a list version of the same logic would hang forever trying to build the whole thing:
```python
def naturals():
    n = 1
    while True:
        yield n
        n += 1

nat = naturals()
[next(nat) for _ in range(5)]   # [1, 2, 3, 4, 5] -- verified, only 5 values ever computed
```

**What a `for` loop actually calls under the hood** — the formal iterator protocol, hand-implemented:
```python
class CountdownIterator:
    def __init__(self, n): self.n = n
    def __iter__(self): return self            # for calls iter(obj) first, needs an object with __next__
    def __next__(self):
        if self.n <= 0: raise StopIteration       # this IS how "the loop ends" is signaled
        val = self.n; self.n -= 1
        return val

for val in CountdownIterator(3):
    print("manual iterator got:", val)
```
✅ OK — verified output: `manual iterator got: 3`, `2`, `1` — identical behavior to the generator version, just written out by hand.

---

## 7. Closures & Scoping (the LEGB rule)

**What LEGB means:** when Python looks up a name, it checks, in this exact order: **L**ocal (inside the current function) → **E**nclosing (any function this one is nested inside) → **G**lobal (module-level) → **B**uilt-in (`len`, `print`, etc.). The first match wins.

**What `nonlocal` means:** "when I ASSIGN to this name inside a nested function, modify the version from the nearest ENCLOSING function scope, don't create a new local variable." Without it, Python's rule is: any name you assign to anywhere in a function is treated as local to that function, for the ENTIRE function body — even on lines before the assignment.

```python
def make_counter():
    count = 0
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

counter1 = make_counter()
counter2 = make_counter()       # a totally SEPARATE 'count' -- closures don't share state with each other
```
✅ OK — verified:
```python
counter1()   # 1
counter1()     # 2
counter1()       # 3
counter2()          # 1 -- independent from counter1
```
❌ ERROR — removing `nonlocal` breaks it, because `count += 1` is an assignment to `count`, which makes Python treat `count` as LOCAL to `increment` for its whole body — including the READ half of `count += 1`, which happens before any local `count` has been given a value:
```python
def make_counter_broken():
    count = 0
    def increment():
        count += 1   # no nonlocal here
        return count
    return increment

make_counter_broken()()
# UnboundLocalError: local variable 'count' referenced before assignment
```

**The classic late-binding closure gotcha:** a lambda (or nested function) defined inside a loop doesn't "remember" the loop variable's value at the time it was created — it remembers the VARIABLE itself, and looks up its CURRENT value whenever it's finally called. (This is the closure behavior flagged as worth remembering back in the Lambda section — here's the full story.)
```python
funcs = []
for i in range(3):
    funcs.append(lambda: i)
```
❌ Not an error, but a very common surprise — by the time any of these lambdas actually runs, the loop has already finished and `i` is stuck at its final value:
```python
[f() for f in funcs]      # [2, 2, 2] -- verified; ALL three see the FINAL value of i, not 0, 1, 2!
```
✅ OK — the fix: use a default-argument value, since default arguments are evaluated exactly once, at the moment the `def`/`lambda` is created, capturing the CURRENT value right then:
```python
funcs_fixed = []
for i in range(3):
    funcs_fixed.append(lambda i=i: i)   # i=i grabs the value NOW, not later

[f() for f in funcs_fixed]   # [0, 1, 2] -- verified, correct
```

**`nonlocal` vs `global`:** `nonlocal` reaches into the nearest ENCLOSING function's scope. `global` skips straight past any enclosing function scopes and reaches the MODULE (top-level) scope directly.
```python
g = "global value"
def outer():
    g = "outer value"                # a NEW g, local to outer(), shadowing the module-level g
    def inner_nonlocal():
        nonlocal g
        g = "modified by inner (nonlocal)"
    def inner_global():
        global g
        g = "modified by inner (global)"
    inner_nonlocal()
    print(g)   # this reads OUTER's g
    inner_global()
    print(g)     # this ALSO reads outer's g -- global didn't touch it
```
✅ OK — verified:
```
after nonlocal: modified by inner (nonlocal)
after global (outer's g is unchanged): modified by inner (nonlocal)
```
And after `outer()` returns, checking the truly module-level `g` shows `inner_global()`'s change landed somewhere completely different:
```python
outer()
print(g)   # "modified by inner (global)" -- the MODULE-level g, untouched by inner_nonlocal -- verified
```

Quick reference:
```
LEGB       → Local -> Enclosing -> Global -> Built-in, name lookup order
nonlocal    → modify a name from the nearest ENCLOSING function scope
global       → modify a name from MODULE scope directly, skipping enclosing functions
assigning to a name anywhere in a function → makes it LOCAL for the WHOLE function body,
              UNLESS you declare nonlocal/global first (verified: UnboundLocalError without it)
late-binding closures in a loop  → lambda captures the VARIABLE, not its value at creation time
                                    (verified: [2,2,2]) -- fix with a default arg, e.g. lambda i=i: i
                                    (verified: [0,1,2])
```

---

## 8. Decorators

**What a decorator is:** just a function that takes a function as input and returns a (usually wrapped) function as output. `@decorator` written above a `def` is pure syntax sugar — it's rewritten by Python into `name = decorator(name)`.

```python
import functools

def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"calling {func.__name__}({args}, {kwargs})")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result}")
        return result
    return wrapper

@log_calls
def add(a, b):
    """Adds two numbers."""
    return a + b
```
✅ OK — verified:
```python
add(2, 3)
# calling add((2, 3), {})
# add returned 5
```

**What `functools.wraps` is for:** without it, `wrapper` (the inner function) REPLACES `add` entirely, so `add.__name__` would become `"wrapper"` and `add.__doc__` would become `None` — you'd lose the original function's identity. `functools.wraps(func)` copies that metadata across.
```python
add.__name__   # "add"               -- preserved thanks to functools.wraps -- verified
add.__doc__      # "Adds two numbers." -- also preserved -- verified
```
⚠️ To see the difference, removing `@functools.wraps(func)` from `wrapper`'s definition would make `add.__name__` print `"wrapper"` instead of `"add"` — the exact bug `functools.wraps` exists to prevent.

**Decorator factories** — a decorator that itself needs configuration (arguments) requires one extra level of nesting: a function that RETURNS a decorator.
```python
def repeat(n):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return [func(*args, **kwargs) for _ in range(n)]
        return wrapper
    return decorator

@repeat(3)
def greet(name): return f"hello {name}"
```
✅ OK — verified: `greet("Aaron") == ['hello Aaron', 'hello Aaron', 'hello Aaron']`

**What `@decorator` desugars to** — proving it's truly just a function call, nothing magic:
```python
def plain_add(a, b): return a + b
decorated_add = log_calls(plain_add)   # manually doing what @log_calls above a def would do
```
✅ OK — verified: `decorated_add(4, 5)` prints the exact same logging lines and returns `9`, identical to having written `@log_calls` above `def plain_add`.

Quick reference:
```
@decorator above a def   → sugar for: name = decorator(name)
functools.wraps(func)      → preserves func.__name__/__doc__ on the wrapper -- omit it and both are LOST
decorator factory (a decorator taking arguments) → needs one EXTRA level of nesting:
                              outer function(args) -> returns the actual decorator(func) -> returns wrapper
```

---

## 9. Context Managers

**What `with` guarantees:** the cleanup code runs no matter how the block exits — normally, or via an exception. This is implemented through two special methods: `__enter__` (runs at the start of `with`) and `__exit__` (runs at the end, ALWAYS, even after an exception).

```python
class ManagedResource:
    def __init__(self, name): self.name = name
    def __enter__(self):
        print(f"acquiring {self.name}")
        return self                       # becomes the 'as' variable
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"releasing {self.name} (exception: {exc_type})")
        return False                       # False = don't suppress the exception, let it propagate
```
✅ OK — the normal, no-exception path:
```python
with ManagedResource("file A") as r:
    print(f"using {r.name}")
# acquiring file A
# using file A
# releasing file A (exception: None)
```
✅ OK — and even when an exception is raised INSIDE the block, `__exit__` still runs (verified: "releasing file B" prints BEFORE the `except` block even catches anything):
```python
try:
    with ManagedResource("file B") as r:
        raise ValueError("something went wrong")
except ValueError as e:
    print("caught:", e)
# acquiring file B
# releasing file B (exception: <class 'ValueError'>)
# caught: something went wrong
```

**What `__exit__`'s return value controls:** if `__exit__` returns a truthy value (like `True`), the exception is SWALLOWED — it never reaches any `except` block outside the `with`. Returning `False` (or nothing) lets it propagate normally.
```python
class Suppressor:
    def __enter__(self): return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        print("suppressing:", exc_type)
        return True   # True = swallow the exception
```
⚠️ OK, but a common surprise if you're not expecting it — the exception genuinely never reaches anywhere else:
```python
with Suppressor():
    raise ValueError("this will be silently suppressed")
print("execution continues here -- the ValueError never propagated")
```
✅ Verified output:
```
suppressing: <class 'ValueError'>
execution continues here -- the ValueError never propagated
```

**`contextlib.contextmanager`** lets you write a context manager as a generator function instead of a full class — everything before `yield` is `__enter__`, everything after (typically in a `finally`) is `__exit__`:
```python
import contextlib

@contextlib.contextmanager
def managed_resource(name):
    print(f"acquiring {name}")
    try:
        yield name
    finally:
        print(f"releasing {name}")   # guaranteed to run even if the 'with' body raises
```
✅ OK — verified: `with managed_resource("socket") as s:` prints `acquiring socket` / `using socket` / `releasing socket`, and even when the body raises (`with managed_resource("socket2")` then `raise RuntimeError("boom")`), `releasing socket2` still prints before the `except RuntimeError` catches `boom`.

Quick reference:
```
with / __enter__ / __exit__       → guaranteed cleanup, runs even if the block raises an exception
__exit__ returns True (truthy)       → SWALLOWS the exception -- it never propagates further (verified)
__exit__ returns False (or nothing)     → lets the exception propagate normally (the usual choice)
contextlib.contextmanager                 → write a context manager as a generator: code before yield
                                             = __enter__, code after (in finally) = __exit__
```

---

## 10. Dunder Methods — Python's Operator Overloading

**What "dunder" methods are:** methods with names like `__add__`, `__eq__`, surrounded by double underscores ("dunder"). Python calls these automatically in response to operators and built-in functions — this is Python's direct equivalent of C++'s `operator+`, `operator==`, etc.

```python
class Vec2:
    def __init__(self, x, y): self.x, self.y = x, y
    def __repr__(self): return f"Vec2({self.x}, {self.y})"     # for repr()/interactive shell -- DEVS
    def __str__(self):  return f"({self.x}, {self.y})"           # for str()/print() -- USERS
    def __add__(self, other): return Vec2(self.x + other.x, self.y + other.y)   # self + other
    def __eq__(self, other): return isinstance(other, Vec2) and self.x == other.x and self.y == other.y
    def __hash__(self): return hash((self.x, self.y))
    def __len__(self): return int((self.x**2 + self.y**2) ** 0.5)
    def __getitem__(self, index): return (self.x, self.y)[index]
```
✅ OK — each operator/built-in maps to exactly one dunder call, all verified:
```python
a, b = Vec2(1, 2), Vec2(3, 4)
repr(a)              # "Vec2(1, 2)"   -- calls a.__repr__()
str(a)                  # "(1, 2)"       -- calls a.__str__()
a + b                     # (4, 6)         -- calls a.__add__(b)
a == Vec2(1, 2)              # True           -- calls a.__eq__(Vec2(1,2))
len(Vec2(3, 4))                  # 5              -- calls Vec2(3,4).__len__()
a[0], a[1]                          # 1 2            -- calls a.__getitem__(0), a.__getitem__(1)
```

**Important rule: defining `__eq__` WITHOUT also defining `__hash__` makes your objects UNHASHABLE** — Python assumes that if you customized equality, the default identity-based hash is no longer safe to use, so it removes hashability rather than risk silently-wrong behavior in sets/dicts.
```python
class NoHash:
    def __init__(self, x): self.x = x
    def __eq__(self, other): return self.x == other.x
    # no __hash__ defined
```
❌ ERROR:
```python
{NoHash(1)}
# TypeError: unhashable type: 'NoHash'
```
✅ OK — this is exactly why `Vec2` above explicitly defines `__hash__` alongside `__eq__`:
```python
s = {a, Vec2(1, 2), b}   # works because Vec2 defines BOTH __eq__ and __hash__
len(s)                       # 2 -- (1,2) counted once even though two EQUAL-but-different objects were added
```

`__getitem__` alone (without `__iter__`) is enough to make an object iterable — this is a legacy protocol Python still supports, predating the modern `__iter__`/`__next__` approach from section 6:
```python
for v in a:   # Python tries a[0], a[1], a[2], ... until IndexError
    print(v)    # 1, 2 -- verified, stops automatically once the index runs out
```

Quick reference:
```
__repr__          → unambiguous, for developers (repr(), interactive shell)
__str__            → readable, for users (str(), print()) -- falls back to __repr__ if undefined
__add__/__sub__/... → arithmetic operators
__eq__               → == ; defining it WITHOUT __hash__ makes the object UNHASHABLE (verified TypeError)
__hash__              → REQUIRED alongside __eq__ if instances need to go into a set/dict key
__len__                → len(obj)
__getitem__              → obj[i]; ALSO enables `for` iteration on its own (legacy protocol)
```

---

## 11. Inheritance, super(), MRO & the Diamond Problem, ABCs

**What `super()` means:** it does NOT mean "my direct parent class." It means "the NEXT class in this object's MRO (Method Resolution Order)" — a specific, precomputed list of classes Python walks through for method lookups.

```python
class Animal:
    def speak(self): return "Animal speaks"
class Dog(Animal):
    def speak(self): return f"{super().speak()}, then Dog barks"
```
✅ OK — verified: `Dog().speak() == "Animal speaks, then Dog barks"`

**The diamond problem** (two classes sharing a common ancestor, both inherited by a third class) is resolved automatically and deterministically via an algorithm called C3 linearization — every class's `super()` is called exactly once, in one well-defined order:
```python
class A:
    def who(self): return "A"
class B(A):
    def who(self): return f"B -> {super().who()}"
class C(A):
    def who(self): return f"C -> {super().who()}"
class D(B, C):
    def who(self): return f"D -> {super().who()}"
```
✅ OK — verified:
```python
D().who()          # "D -> B -> C -> A"  -- each class visited exactly once
D.__mro__            # (D, B, C, A, object)
```
Contrast with C++ (see `cpp_study_summary.md` section 16): C++ requires you to explicitly write `virtual` inheritance to avoid getting TWO separate copies of the shared base class; Python's MRO makes single-copy, well-ordered resolution the automatic default — there's no equivalent of C++'s "duplicated base subobject" problem to even worry about.

**But base-class ORDER can conflict**, and Python detects this and refuses to guess:
```python
class A: pass
class B(A): pass
```
❌ ERROR — listing `A` before `B` in the bases contradicts the fact that `B` already comes after `A` (since `B` inherits from `A`); Python can't build a linearization satisfying both requirements at once:
```python
class C(A, B): pass
# TypeError: Cannot create a consistent method resolution order (MRO) for bases A, B
```
✅ Fix: list them in an order consistent with the existing hierarchy — `class C(B, A)` works fine, since `B` already implies `A` comes after it.

**Abstract base classes (`abc.ABC`)** are Python's explicit, NOMINAL-typing mechanism — a class must EXPLICITLY inherit from an ABC and implement all its `@abstractmethod`s to be instantiable at all:
```python
from abc import ABC, abstractmethod
class Shape(ABC):
    @abstractmethod
    def area(self): ...

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return 3.14159 * self.r ** 2
```
❌ ERROR — `Shape` itself can never be instantiated, because it has an unimplemented abstract method:
```python
Shape()
# TypeError: Can't instantiate abstract class Shape with abstract method area
```
✅ OK — `Circle` implemented `area()`, so it CAN be instantiated:
```python
Circle(2).area()   # 12.56636 -- verified
```

Quick reference:
```
super()                 → calls the NEXT class in the MRO, not simply "my parent"
diamond inheritance         → resolved automatically via C3 linearization, each class visited ONCE
inconsistent base order        → TypeError: Cannot create a consistent MRO (verified) --
                                  list base classes in an order that matches the existing hierarchy
ABC + @abstractmethod              → NOMINAL typing -- must inherit AND implement every abstract
                                      method, or instantiation fails (verified TypeError)
```

---

## 12. Structural Typing with typing.Protocol (Duck Typing, Formalized)

`typing.Protocol` is the opposite philosophy from `ABC`: **no inheritance required at all** — an object counts as matching the protocol purely because it has the right methods (structural typing), which is duck typing (section 1) made into something you can actually check with `isinstance`.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class HasArea(Protocol):
    def area(self) -> float: ...

class Circle:                     # does NOT inherit from HasArea in any way
    def __init__(self, r): self.r = r
    def area(self): return 3.14159 * self.r ** 2

class Unrelated:
    pass                              # no area() method at all
```
✅ OK — verified: `isinstance(Circle(2), HasArea)` is `True` even though `Circle` never mentions `HasArea` anywhere — it just happens to have a matching `area()` method.
❌ Verified `False`: `isinstance(Unrelated(), HasArea)` — no `area()` method means no structural match, `Protocol` still correctly says no.

**What `@runtime_checkable` is for:** `isinstance()` checks against a `Protocol` only work if the protocol is explicitly marked `@runtime_checkable`. Without that decorator, `isinstance` refuses to even attempt the check:
```python
class HasAreaNoRuntime(Protocol):     # missing @runtime_checkable
    def area(self) -> float: ...
```
❌ ERROR:
```python
isinstance(Circle(), HasAreaNoRuntime)
# TypeError: Instance and class checks can only be used with @runtime_checkable protocols
```

Quick reference:
```
ABC (abc.ABCMeta)     → NOMINAL typing -- must EXPLICITLY inherit to be recognized
typing.Protocol         → STRUCTURAL typing -- matching methods alone is enough, no inheritance
@runtime_checkable        → REQUIRED before isinstance()/issubclass() can be used with a Protocol
                            (verified: omitting it raises TypeError on the isinstance check itself)
```

---

## 13. Exception Handling

**What each clause does:** `try` runs the risky code. `except` catches a matching exception type. `else` runs ONLY IF no exception was raised in the `try` block. `finally` ALWAYS runs, whether or not an exception occurred, and even if the exception was never caught.

```python
def risky(x):
    if x < 0: raise ValueError(f"negative value: {x}")
    return 100 / x

for val in [5, 0, -1]:
    try:
        result = risky(val)
    except ZeroDivisionError:
        print(f"val={val}: caught ZeroDivisionError")
    except ValueError as e:
        print(f"val={val}: caught ValueError: {e}")
    else:
        print(f"val={val}: success, result={result}")
    finally:
        print(f"val={val}: finally always runs")
```
✅ OK — verified output shows all three paths (success, ZeroDivisionError, ValueError), and `finally` fires every single time regardless of which path was taken:
```
val=5: success, result=20.0
val=5: finally always runs
val=0: caught ZeroDivisionError
val=0: finally always runs
val=-1: caught ValueError: negative value: -1
val=-1: finally always runs
```

**Custom exception hierarchies** — catching a base exception class also catches every subclass of it, exactly like catching a base class pointer in C++:
```python
class AppError(Exception):
    """Base class for this app's errors."""
class ValidationError(AppError):
    def __init__(self, field):
        super().__init__(f"validation failed for field: {field}")
        self.field = field
```
✅ OK — verified: `except AppError` catches a raised `ValidationError`, because `ValidationError` IS an `AppError`:
```python
try:
    raise ValidationError("email")
except AppError as e:
    print(e)          # "validation failed for field: email"
    print(e.field)      # "email"
```

**`raise X from Y`** preserves the ORIGINAL exception as `.__cause__` when you deliberately re-raise as a different, more meaningful exception type — instead of losing the original error entirely:
```python
def parse_config(raw):
    try:
        return int(raw)
    except ValueError as original:
        raise AppError(f"could not parse config value: {raw!r}") from original
```
✅ OK — verified: the new `AppError`'s message is what you see first, but the ORIGINAL `ValueError` is still attached and inspectable:
```python
try:
    parse_config("not_a_number")
except AppError as e:
    print(e)                    # "could not parse config value: 'not_a_number'"
    print(repr(e.__cause__))      # ValueError("invalid literal for int() with base 10: 'not_a_number'")
```

Quick reference:
```
try/except/else/finally   → else runs ONLY on success; finally ALWAYS runs, no exceptions to this rule
except BaseClass             → also catches every SUBCLASS of BaseClass (verified)
raise X from Y                 → chains exceptions, preserves the original as X.__cause__ (verified)
```

---

## 14. Type Hints & Dataclasses

**What a type hint is (and isn't):** `def add(a: int, b: int) -> int` documents the intended types for tooling (editors, `mypy`) to check STATICALLY, before the program even runs. Python itself does NOT enforce these hints at runtime — nothing stops you from calling the function with the "wrong" types.

```python
def add(a: int, b: int) -> int:
    return a + b
```
✅ OK, used as intended:
```python
add(2, 3)             # 5 -- verified
```
⚠️ Also "works," despite completely violating the hints, because `str` also supports `+` — Python never checked the hint at all:
```python
add("foo", "bar")        # "foobar" -- verified; a type checker like mypy WOULD flag this as an error,
                            # but the Python interpreter runs it without complaint
```

`Optional[str]` means "either a `str`, or `None`." `Union[int, str]` means "either an `int` or a `str`":
```python
from typing import Optional, Union

def find_user(uid: int) -> Optional[str]:
    return {"1": "Aaron"}.get(str(uid))
```
✅ OK — verified: `find_user(1) == "Aaron"`, `find_user(99) is None`.

**`@dataclass`** auto-generates `__init__`, `__repr__`, and `__eq__` for you, purely from type-annotated class-level fields:
```python
from dataclasses import dataclass, field

@dataclass
class Point:
    x: int
    y: int
    label: str = "point"
    tags: list = field(default_factory=list)
```
✅ OK — verified:
```python
p1, p2 = Point(1, 2), Point(1, 2)
p1               # Point(x=1, y=2, label='point', tags=[])  -- auto __repr__
p1 == p2            # True  -- auto __eq__, compares field values
```

**Fields WITHOUT a default must come BEFORE fields WITH a default** — same rule as a normal Python function signature, and it's enforced at class-DEFINITION time, not at instantiation time:
```python
@dataclass
class Bad:
    x: int = 1
    y: int          # no default, but comes AFTER a field that has one
```
❌ ERROR, raised immediately when the class body is defined:
```python
# TypeError: non-default argument 'y' follows default argument
```

**Why `tags: list = field(default_factory=list)` instead of `tags: list = []`:** this is `@dataclass`'s own built-in fix for exactly the mutable-default-argument trap from section 2 — `field(default_factory=list)` calls `list()` fresh for EVERY instance:
```python
p1.tags.append("a")
p1.tags               # ['a']  -- verified
p2.tags                 # []     -- verified, p2 got its OWN independent list, not a shared one
```

**`@dataclass(frozen=True)`** makes instances immutable after construction:
```python
@dataclass(frozen=True)
class ImmutablePoint:
    x: int; y: int

ip = ImmutablePoint(1, 2)
```
❌ ERROR:
```python
ip.x = 99
# dataclasses.FrozenInstanceError: cannot assign to field 'x'
```

Quick reference:
```
type hints                   → documentation + tooling (mypy) ONLY -- NOT enforced by Python at runtime
                                (verified: add("foo","bar") "succeeds" despite violating int hints)
@dataclass                     → auto __init__/__repr__/__eq__ from annotated fields
non-default field after default field → TypeError at class-definition time (verified)
field(default_factory=list)              → the dataclass-native fix for the mutable-default trap
                                            (verified: each instance gets its OWN list)
@dataclass(frozen=True)                     → immutable -- assigning to a field raises
                                               FrozenInstanceError (verified)
```

---

## 15. functools Essentials

**`functools.lru_cache`** memoizes a function — remembers each unique set of arguments it's been called with, and returns the cached result instead of recomputing on repeat calls. This turns naive exponential-recursion algorithms into linear ones:
```python
import functools

@functools.lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n-1) + fib(n-2)
```
✅ OK — verified: `fib(30) == 832040`, and the function body actually only runs 31 times total (once per unique `n`), versus roughly 2,692,537 calls for the identical function WITHOUT `@lru_cache` — the exponential blowup you'd otherwise get from naive recursive Fibonacci.

**`functools.partial`** pre-fills some of a function's arguments and hands you back a new, narrower callable:
```python
def power(base, exponent): return base ** exponent
square = functools.partial(power, exponent=2)
cube = functools.partial(power, exponent=3)
```
✅ OK — verified: `square(5) == 25`, `cube(5) == 125`.

**`functools.reduce`** folds a sequence down to one value by repeatedly applying a two-argument function (this is the same `reduce` used with `lambda` in the Lambda section above):
```python
nums = [1, 2, 3, 4, 5]
functools.reduce(lambda acc, x: acc + x, nums)   # 15 -- verified
```
❌ ERROR — with no initial value and an EMPTY sequence, there's nothing to start from, and `reduce` refuses to guess:
```python
functools.reduce(lambda acc, x: acc + x, [])
# TypeError: reduce() of empty iterable with no initial value
```
✅ OK — the fix is an explicit initial/starting value, which also correctly handles the empty case:
```python
functools.reduce(lambda acc, x: acc + x, [], 0)   # 0 -- verified
```

Quick reference:
```
lru_cache(maxsize=None)   → memoizes -- verified 31 calls vs ~2.7 million for the uncached version of fib(30)
partial(func, **preset)     → pre-binds some arguments, returns a new narrower callable
reduce(fn, seq)               → folds a sequence to one value; EMPTY seq + no initial value -> TypeError
                                 (verified) -- always safer to pass an explicit initial value
```

---

## 16. Slicing — a[start:stop:step], and Does It Work on "Arrays" Too?

**What slicing means:** `seq[start:stop:step]` pulls out a whole sub-sequence at once, instead of one element like `seq[i]` does. `start` is the first index INCLUDED, `stop` is the first index EXCLUDED (the slice stops right before it), and `step` is how many positions to move each time (defaults to `1`). Any of the three can be omitted, and each has its own default.

```python
a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```
✅ OK — verified, one example per piece of the syntax:
```python
a[2:5]      # [2, 3, 4]        -- start=2, stop=5 (5 itself is EXCLUDED), step defaults to 1
a[:4]         # [0, 1, 2, 3]     -- omitted start defaults to 0 (the beginning)
a[6:]           # [6, 7, 8, 9]     -- omitted stop defaults to len(seq) (the end)
a[:]              # [0, 1, ..., 9]   -- omitting BOTH copies the WHOLE sequence
a[::2]              # [0, 2, 4, 6, 8]  -- step=2, every other element
a[1::2]               # [1, 3, 5, 7, 9]  -- start=1, step=2
a[::-1]                 # [9, 8, 7, ..., 0] -- step=-1 walks BACKWARD, reversing the whole sequence
```

**Negative indices count backward from the end** (`-1` is the last element, `-2` the second-to-last, and so on) — this works in slices exactly like it does for single-element indexing:
```python
a[-3:]      # [7, 8, 9]         -- verified, the LAST 3 elements
a[:-3]        # [0, 1, 2, 3, 4, 5, 6]  -- verified, everything EXCEPT the last 3
a[-5:-2]        # [5, 6, 7]         -- verified, from the 5th-from-end up to (not including) the 2nd-from-end
```

**A slice with an out-of-range index does NOT raise an error — it just clamps to whatever actually exists.** This is a real, deliberate difference from plain indexing, which DOES raise for an out-of-range position:
```python
a[100:200]      # []                     -- verified, empty list, NOT a crash
a[3:1000]         # [3, 4, 5, 6, 7, 8, 9]   -- verified, silently clamped to the real length
```
❌ Compare plain indexing on the exact same list:
```python
a[100]
# IndexError: list index out of range
```

**Slicing works on any built-in SEQUENCE type, not just `list`** — the type of the slice you get back always matches the type of the thing you sliced:
```python
(0, 1, 2, 3, 4)[1:3]       # (1, 2)          -- tuple in, tuple out -- verified
"hello world"[0:5]           # "hello"         -- str in, str out -- verified
range(10)[2:5]                  # range(2, 5)      -- range in, ANOTHER range out -- still lazy, no list built!
b"hello"[1:3]                      # b'el'            -- bytes in, bytes out -- verified
bytearray(b"hello")[1:3]              # bytearray(b'el')  -- verified
```

**Slicing does NOT work on `dict` or `set`**, because slicing needs a notion of ORDERED POSITIONS, and neither of those is indexed by position at all:
```python
{"a": 1, "b": 2}[0:1]
```
❌ ERROR — Python tries to use the slice itself as a dict KEY, and slice objects aren't hashable:
```python
# TypeError: unhashable type: 'slice'
```
❌ ERROR — a `set` doesn't support indexing of ANY kind, position-based or otherwise:
```python
{1, 2, 3}[0:1]
# TypeError: 'set' object is not subscriptable
```

**Slice ASSIGNMENT can replace a whole range at once — and can even change the length of a list**, since you're not required to supply the same number of replacement elements as the range you're replacing:
```python
a = [1, 2, 3, 4, 5]
a[1:3] = [10, 20, 30]    # replacing 2 elements (index 1 and 2) with THREE new ones
```
✅ OK — verified: `a == [1, 10, 20, 30, 4, 5]` — the list GREW by one element.
```python
a2 = [1, 2, 3, 4, 5]
a2[1:4] = []                # replacing a range with an EMPTY list deletes it
```
✅ OK — verified: `a2 == [1, 5]`
```python
a3 = [1, 2, 3, 4, 5]
del a3[1:3]                    # del also accepts a slice directly
```
✅ OK — verified: `a3 == [1, 4, 5]`
```python
a4 = [1, 2, 3]
a4[1:1] = [10, 20]                # an EMPTY slice range (1:1) means pure INSERTION, nothing is removed
```
✅ OK — verified: `a4 == [1, 10, 20, 2, 3]`

**A slice is secretly a real, first-class object — `slice(start, stop, step)`** — `a[1:4]` is just syntax sugar for `a[slice(1, 4)]`, and you can build and reuse a `slice` object explicitly:
```python
s = slice(1, 4)
a[s]                      # [2, 3, 4] -- verified, identical to a[1:4]
reverser = slice(None, None, -1)
a[reverser]                  # verified, identical to a[::-1]
type(s)                        # <class 'slice'> -- verified, a genuine builtin type
s.start, s.stop, s.step           # 1 4 None -- verified, the pieces are readable attributes
```

**The single most important gotcha for anyone doing numerical/ML work: `list`/`tuple`/`str` slicing always makes a COPY, but NumPy array slicing returns a VIEW that shares the SAME underlying memory.**
```python
py_list = [1, 2, 3, 4, 5]
py_slice = py_list[1:4]
py_slice[0] = 999
```
✅ OK — verified: `py_list` is STILL `[1, 2, 3, 4, 5]` — completely unaffected, because `py_slice` was an independent copy.
```python
import numpy as np
np_arr = np.array([1, 2, 3, 4, 5])
np_slice = np_arr[1:4]
np_slice[0] = 999
```
⚠️ Not an error, but a very consequential difference — verified: `np_arr` becomes `[1, 999, 3, 4, 5]` — the ORIGINAL array changed, because `np_slice` is a VIEW into the exact same memory buffer, not a copy:
```python
np.shares_memory(np_arr, np_slice)   # True -- verified, they are genuinely the same underlying data
```
✅ To force an independent copy of a NumPy slice, call `.copy()` explicitly:
```python
np_arr2 = np.array([1, 2, 3, 4, 5])
safe_copy = np_arr2[1:4].copy()
safe_copy[0] = 777
```
✅ OK — verified: `np_arr2` remains `[1, 2, 3, 4, 5]`, unaffected, because `.copy()` broke the memory sharing.

The standard-library `array.array` (a compact, typed array, closer to a C array than a `list` is) behaves like a normal Python `list` here — slicing it makes a COPY, NOT a view:
```python
import array
arr = array.array('i', [1, 2, 3, 4, 5])
arr_slice = arr[1:4]
arr_slice[0] = 999
```
✅ OK — verified: `arr` remains `array('i', [1, 2, 3, 4, 5])`, unaffected — only NumPy arrays give you view semantics; `array.array` does not.

Quick reference:
```
seq[start:stop:step]   → start included, stop EXCLUDED, step defaults to 1; any piece can be omitted
seq[:]                    → shallow copy of the WHOLE sequence (see also section 17, Copy Semantics)
seq[::-1]                    → reverses the sequence (step = -1)
negative indices                → count from the end (-1 = last element)
out-of-range slice bounds          → silently CLAMPED, never raises (verified) -- unlike seq[i] (verified IndexError)

works on: list, tuple, str, range, bytes, bytearray -- result is the SAME TYPE as the original (verified)
does NOT work on: dict (verified: TypeError, unhashable slice), set (verified: not subscriptable)

slice assignment (a[1:3] = [...])   → can change the list's LENGTH, not just its contents (verified)
a[i:i] = [...]                        → pure insertion at position i, nothing removed (verified)
del a[i:j]                              → deletes that range in place (verified)

slice(start, stop, step)                  → the slice syntax is sugar for this real, reusable
                                             builtin object -- a[1:4] === a[slice(1, 4)] (verified)

list/tuple/str/array.array slicing            → always makes an independent COPY (verified)
NumPy array slicing                             → returns a VIEW sharing the SAME memory (verified) --
                                                    mutating the slice mutates the original array too;
                                                    call .copy() explicitly if you need independence
```

---

## 17. Copy Semantics: Shallow vs Deep

**What a shallow copy means:** `copy.copy()` builds a NEW outer container, but every object INSIDE it is still the SAME object as in the original — nothing nested gets duplicated. **What a deep copy means:** `copy.deepcopy()` recursively duplicates everything, all the way down, so nothing is shared at all.

```python
import copy

original = [[1, 2], [3, 4]]
shallow = copy.copy(original)
deep = copy.deepcopy(original)
```
✅ OK — but notice what mutating a NESTED element through `shallow` does:
```python
shallow[0].append(99)
original    # [[1, 2, 99], [3, 4]] -- verified, the ORIGINAL changed too, via the SHARED inner list!
shallow       # [[1, 2, 99], [3, 4]]
deep            # [[1, 2], [3, 4]]     -- verified, completely unaffected
```
Proof of exactly what's shared and what isn't:
```python
original is shallow                     # False -- verified, different OUTER list objects
original[0] is shallow[0]                 # True  -- verified, SAME inner list object (this is the trap)
original[0] is deep[0]                      # False -- verified, deepcopy truly duplicated it
```

⚠️ **Slicing (`a[:]`) and `list(a)` also produce only a SHALLOW copy** — a very common gotcha, since slicing "feels like" it should make a completely independent copy:
```python
a = [[1], [2]]
b = a[:]                     # looks independent, but is only a SHALLOW copy
b[0].append("x")
a   # [[1, 'x'], [2]] -- verified, `a` changed too, because b[0] and a[0] are the SAME inner list
```
✅ For FLAT lists containing only immutable values (ints, strings), a shallow copy is completely safe, since there's no nested mutable object to accidentally share:
```python
flat = [1, 2, 3]
flat_copy = flat[:]
flat_copy.append(4)
flat        # [1, 2, 3]     -- verified, unaffected -- ints can't be mutated in place anyway
flat_copy     # [1, 2, 3, 4]
```

Quick reference:
```
copy.copy (shallow)     → new OUTER container, but nested objects are still SHARED (verified: mutating
                           a nested list through the copy also changes the original)
copy.deepcopy             → fully independent, recursive copy -- nothing shared at any depth (verified)
slicing (a[:]) / list(a)     → ALSO only shallow -- same sharing trap as copy.copy (verified)
safe to shallow-copy           → flat containers of IMMUTABLE values only (ints, strings, tuples of those)
```

---

## 18. The GIL, Threading, Multiprocessing & Asyncio

This is Python's version of the C++ concurrency section — but the story is very different because of the **GIL (Global Interpreter Lock)**: only one thread executes Python bytecode at a time, no matter how many CPU cores are available.

**What this means for CPU-bound work:** running CPU-heavy Python code across multiple threads gives essentially ZERO speedup, because the threads are still forced to take turns on that one lock — verified by timing on this 2-core machine:
```python
import threading, time

def cpu_bound(n):
    count = 0
    for _ in range(n): count += 1
    return count

N = 20_000_000
# baseline: cpu_bound(N) run twice, back to back, on one thread
# vs: two Thread objects, each running cpu_bound(N), started and joined
```
✅ Timed and verified:
```
sequential (2x20000000):   0.519s
2 threads (each 20000000):  0.521s
speedup from threading: 1.00x   -- essentially NO improvement; the GIL serializes them anyway
```

**`multiprocessing` gets around the GIL entirely** by using separate OS PROCESSES instead of threads — each process gets its own Python interpreter and its own independent GIL, so they truly run in parallel on separate cores:
```python
import multiprocessing
# identical cpu_bound(N) workload, but run via 2 separate Process objects instead of Thread objects
```
✅ Timed and verified — close to the theoretical best on 2 cores:
```
sequential (2x20000000):     0.579s
2 processes (each 20000000):  0.303s
speedup from multiprocessing: 1.91x   -- genuine parallel execution
```

**Threading DOES help for I/O-bound work** (waiting on a network socket, disk, or `sleep`) — CPython releases the GIL specifically while a thread is blocked on I/O, letting a different thread run during that wait:
```python
import threading, time
def io_bound(n): time.sleep(n)   # simulates a network/disk wait
```
✅ Timed and verified — this time threading DOES pay off:
```
sequential (2x0.3s sleep):    0.601s
2 threads (each 0.3s sleep):   0.301s
speedup from threading: 1.99x   -- ~2x speedup, because the GIL WAS released during each sleep
```

**`asyncio` gets similar I/O-bound concurrency without any OS threads at all**, using cooperative `await` — a single thread voluntarily pauses one task and runs another whenever it hits an `await`:
```python
import asyncio

async def io_bound(n, name):
    print(f"{name}: starting wait")
    await asyncio.sleep(n)     # voluntarily yields control -- another coroutine can run NOW
    print(f"{name}: done waiting")

async def main():
    await asyncio.gather(io_bound(0.3, "task1"), io_bound(0.3, "task2"))
```
✅ Verified output — both waits overlap on a SINGLE thread, no threading module involved at all:
```
task1: starting wait
task2: starting wait
task1: done waiting
task2: done waiting
asyncio.gather (2x0.3s): 0.301s   -- ~0.3s total, not 0.6s
```

⚠️ **An unhandled exception raised inside a `threading.Thread` does NOT propagate to the main thread** — it just gets printed to stderr by Python's default thread exception hook, and the rest of the main program continues running as if nothing happened:
```python
import threading
def bad(): raise ValueError("thread failure")
t = threading.Thread(target=bad)
t.start()
t.join()
print("main continues normally")
```
✅ Verified: a full traceback for `ValueError: thread failure` is printed automatically (from `threading.py`'s internal exception hook), but no exception is ever raised in the main thread — `print("main continues normally")` still executes right after `t.join()`. (If you need to know a thread failed, you must capture the exception yourself, e.g. via `concurrent.futures.ThreadPoolExecutor`, whose `.result()` DOES re-raise it.)

Quick reference:
```
GIL       → only one thread executes Python bytecode at a time, ever, in CPython
threading   → ~1.0x speedup for CPU-bound work (verified, effectively none); ~2x for I/O-bound
              work (verified) because the GIL is released during I/O waits
multiprocessing → ~1.9x speedup for CPU-bound work on 2 cores (verified) -- separate
                   processes, separate GILs, TRUE parallelism; higher overhead (process startup)
asyncio            → cooperative concurrency on ONE thread via await; matches threading's I/O
                      speedup (verified) without any OS thread overhead, scales to many more
                      concurrent waits than real threads can
exception in a Thread   → does NOT propagate to the main thread (verified) -- printed to stderr
                          by default and silently swallowed otherwise

when to use which:
  CPU-bound (crunching numbers)      → multiprocessing
  I/O-bound (network/disk/sleep)       → threading OR asyncio
  contrast with C++ (cpp_study_summary.md section 30) → C++ threads get REAL parallelism for
      CPU-bound work with no GIL involved at all; Python needs multiprocessing for the same result
```

---

## 19. collections Essentials — defaultdict, Counter, namedtuple, deque

**`defaultdict` — a dict that manufactures missing values instead of raising.** Pass it a factory (`list`, `int`, `set`, any zero-arg callable); the first access to a missing key calls the factory and stores the result.

```python
words = ["apple", "banana", "avocado", "blueberry", "cherry"]

plain = {}
plain["a"].append("apple")
```
❌ ERROR — a normal dict has nothing under `"a"` yet:
```python
# KeyError: 'a'
```
✅ OK — `defaultdict(list)` creates the empty list on first touch, so grouping becomes one line per item:
```python
from collections import defaultdict
by_letter = defaultdict(list)
for w in words:
    by_letter[w[0]].append(w)     # no "if key not in dict" dance needed

dict(by_letter)   # {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']} -- verified
```
`defaultdict(int)` makes a counter (missing keys start at 0):
```python
dd = defaultdict(int)
dd["x"] += 1; dd["x"] += 1; dd["y"] += 1
dict(dd)   # {'x': 2, 'y': 1} -- verified
```

**`Counter` — counting, ranking and multiset arithmetic in one type:**
```python
from collections import Counter
c = Counter("mississippi")
c                     # Counter({'i': 4, 's': 4, 'p': 2, 'm': 1}) -- verified, sorted by count
c.most_common(2)      # [('i', 4), ('s', 4)]  -- verified
c["s"]                # 4
c["z"]                # 0  -- missing keys count as 0, NO KeyError -- verified

c + Counter(["a", "b", "a"])           # counts merge: adds 'a': 2, 'b': 1 -- verified
Counter(a=3, b=1) - Counter(a=1, b=2)  # Counter({'a': 2}) -- verified: negative/zero counts dropped
```

**`namedtuple` — a tuple with field names (a lightweight immutable record):**
```python
from collections import namedtuple
Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
p             # Point(x=3, y=4)  -- readable repr for free -- verified
p.x, p[1]     # 3 4 -- access by NAME or by index, it's still a tuple
x, y = p      # unpacks like any tuple -- verified
p._asdict()   # {'x': 3, 'y': 4} -- verified
```
❌ Immutable, like every tuple:
```python
p.x = 99
# AttributeError: can't set attribute
```
✅ For mutable records with types, prefer `@dataclass` (section 14); `namedtuple` wins when you want tuple-compatibility and immutability.

**`deque` — O(1) append/pop at BOTH ends (a list is O(n) at the front):**
```python
from collections import deque
d = deque([2, 3, 4])
d.appendleft(1)          # O(1) — on a list this shifts every element
d.append(5)
d                        # deque([1, 2, 3, 4, 5]) -- verified
d.popleft(), d.pop()     # 1 5 -- verified; d is now deque([2, 3, 4])
```
`maxlen` turns it into a ring buffer — perfect for "keep the last N things":
```python
ring = deque(maxlen=3)
for i in range(1, 6):
    ring.append(i)
ring   # deque([3, 4, 5], maxlen=3) -- verified: 1 and 2 fell off the left automatically
```

Quick reference:
```
defaultdict(factory)   → missing key -> factory() stored & returned (verified: no KeyError)
                         grouping: defaultdict(list); counting: defaultdict(int)
Counter(iterable)      → counts; missing keys are 0 (verified); most_common(n);
                         +/- multiset arithmetic (verified, negatives dropped)
namedtuple             → immutable record; access by name AND index; unpacks like a tuple
                         (verified) — reach for @dataclass when you need mutation/methods
deque                  → O(1) at both ends (list front ops are O(n));
                         maxlen=N = ring buffer, old items fall off (verified)
```

---

## 20. Structural Pattern Matching — match/case (Python 3.10+)

**What `match` does:** compares a value against a sequence of PATTERNS — not just constants like C++ `switch`, but SHAPES: "a 2-element list", "a dict with a name key", "a Point with x=0". First matching case wins, no fallthrough, and patterns can capture variables while matching.

```python
def describe(value):
    match value:
        case 0:                              # literal pattern
            return "zero"
        case int(n) if n < 0:                # capture + GUARD condition
            return f"negative int {n}"
        case int() | float() as n:           # OR-pattern, 'as' captures
            return f"number {n}"
        case [x, y]:                         # sequence pattern, exactly 2
            return f"pair: {x} and {y}"
        case [first, *rest]:                 # sequence with star, like unpacking
            return f"list starting with {first}, {len(rest)} more"
        case {"name": name, **extra}:        # mapping pattern: needs a "name" key
            return f"dict with name={name}, extra keys={list(extra)}"
        case str(s):                         # class pattern: "is it a str?"
            return f"string {s!r}"
        case _:                              # wildcard — the default
            return "something else"
```
✅ Verified, one line per pattern kind:
```python
describe(0)                            # 'zero'
describe(-5)                           # 'negative int -5'          -- guard fired
describe(3.14)                         # 'number 3.14'
describe([1, 2])                       # 'pair: 1 and 2'
describe([7, 8, 9, 10])                # 'list starting with 7, 3 more'
describe({"name": "Aaron", "age": 30}) # "dict with name=Aaron, extra keys=['age']"
describe("hi")                         # "string 'hi'"
describe(None)                         # 'something else'
```

**Class patterns destructure objects by attribute — great with dataclasses:**
```python
@dataclass
class Point:
    x: int
    y: int

def where(p):
    match p:
        case Point(x=0, y=0):  return "origin"
        case Point(x=0, y=y):  return f"on y-axis at {y}"
        case Point(x=x, y=0):  return f"on x-axis at {x}"
        case Point(x=x, y=y):  return f"at ({x}, {y})"

where(Point(0, 0))   # 'origin'         -- verified
where(Point(0, 5))   # 'on y-axis at 5' -- verified
where(Point(3, 4))   # 'at (3, 4)'      -- verified
```

⚠️ **Gotcha:** a bare lowercase name in a case is a CAPTURE (it always matches and binds), not a comparison. `case RED:` doesn't compare against a variable named RED — write `case Color.RED:` (dotted names ARE compared) or use a guard.

Contrast with C++ `switch`: `match` needs no `break` (no fallthrough exists), works on any type (not just integers), and destructures while it matches.

Quick reference:
```
case 0 / case "x"        → literal patterns, compared with ==
case int(n) if n < 0     → class check + capture + guard (verified)
case A() | B() as v      → OR alternatives; 'as' names the match
case [a, b] / [a, *rest] → sequence patterns, star like unpacking (verified)
case {"k": v, **rest}    → mapping pattern — requires the key, captures the value
case Point(x=0, y=y)     → class pattern, destructures by attribute (verified)
case _                   → wildcard default
bare lowercase name      → CAPTURES (always matches!) — dotted/qualified names compare
no fallthrough           → exactly one case runs; no break needed (vs C++ switch)
```

---

## 21. enum — Named Constants Done Right

**Why:** plain module-level constants (`RED = 1`) are just ints — nothing stops `RED == PriorityLow` comparisons or passing 7 where a color belongs. `Enum` members are real typed objects: iterable, printable, and NOT interchangeable with ints.

```python
from enum import Enum, IntEnum, Flag, auto, unique

class Color(Enum):
    RED = auto()      # auto() assigns 1, 2, 3... — no manual numbering
    GREEN = auto()
    BLUE = auto()
```
✅ Verified basics — name, value, lookups in both directions, iteration:
```python
Color.RED            # Color.RED     (readable repr)
Color.RED.name       # 'RED'
Color.RED.value      # 1
Color["GREEN"]       # Color.GREEN   -- lookup by NAME
Color(3)             # Color.BLUE    -- lookup by VALUE
list(Color)          # [<Color.RED: 1>, <Color.GREEN: 2>, <Color.BLUE: 3>]
```
**Members are identity-comparable and NOT equal to their numeric values:**
```python
Color.RED == Color.RED   # True  -- and `is` works too (singletons) -- verified
Color.RED == 1           # False -- an Enum is NOT its int value    -- verified
```
✅ That last line is the type-safety point: accidental int comparisons fail loudly (well — falsely) instead of succeeding by coincidence. Compare C++ `enum class` (cpp summary section 34), which achieves the same with a compile error.

**`IntEnum` — opt IN to int behavior when you genuinely need it:**
```python
class Priority(IntEnum):
    LOW = 1
    MED = 2
    HIGH = 3

Priority.HIGH > 2      # True -- verified, compares with ints
Priority.LOW + 10      # 11   -- verified, does arithmetic
```

**`Flag` — bitwise-combinable enums (permission masks):**
```python
class Perm(Flag):
    READ = auto()      # 1
    WRITE = auto()     # 2
    EXEC = auto()      # 4

rw = Perm.READ | Perm.WRITE
rw                  # Perm.READ|WRITE -- verified
Perm.READ in rw     # True  -- verified
Perm.EXEC in rw     # False -- verified
```

**`@unique` — forbid aliased values:**
```python
@unique
class Dup(Enum):
    A = 1
    B = 1      # without @unique, B would silently become an ALIAS of A
```
❌ ERROR — verified:
```python
# ValueError: duplicate values found in <enum 'Dup'>: B -> A
```

Quick reference:
```
class C(Enum) + auto()  → named singleton constants, values auto-numbered 1..n
.name / .value          → 'RED' / 1 (verified)
C["NAME"] / C(value)    → lookup by name / by value (verified)
Enum member == int      → False (verified) — type safety; use IntEnum to opt into
                          int comparisons/arithmetic (verified)
Flag + | operator       → bitmask-style combinable members, tested with `in` (verified)
@unique                 → duplicate values raise ValueError instead of silently aliasing
```

---

## 22. pathlib & File I/O

**`pathlib.Path` is the modern, object-oriented replacement for `os.path` string juggling** — paths are objects with methods, and `/` joins them.

```python
from pathlib import Path

base = Path("/tmp/demo")
p = base / "notes" / "todo.txt"      # the / operator builds paths — no os.path.join
type(p).__name__                     # 'PosixPath' ('WindowsPath' on Windows) -- verified
```

**Create, write, read — whole-file operations are one-liners:**
```python
p.parent.mkdir(parents=True, exist_ok=True)   # mkdir -p
p.write_text("line one\nline two\n")
p.read_text().splitlines()           # ['line one', 'line two'] -- verified
```

**A path knows its own anatomy:**
```python
p.name        # 'todo.txt'   -- verified
p.stem        # 'todo'
p.suffix      # '.txt'
p.parent.name # 'notes'
p.exists()    # True -- verified
p.stat().st_size   # 18 -- real byte size, verified
```

**Finding files — glob and rglob (recursive):**
```python
sorted(f.name for f in (base / "notes").glob("*.txt"))   # ['b.txt', 'todo.txt'] -- verified
sorted(f.name for f in base.rglob("*.md"))               # ['c.md'] -- verified, searches subtree
```

**Line-by-line and append — `with open()` accepts Path objects directly:**
```python
with open(p, "a", encoding="utf-8") as f:    # "a" = append mode
    f.write("line three\n")

with open(p, encoding="utf-8") as f:         # default mode "r"
    for line in f:                           # file objects are ITERATORS (section 6) — lazy,
        print(line.rstrip())                 # one line at a time, works for huge files
# line one / line two / line three  -- verified
```
✅ `with` guarantees the file closes even if the body raises — this is exactly the context-manager protocol from section 9. ⚠️ Always pass `encoding="utf-8"` explicitly: the default is platform-dependent.

Quick reference:
```
Path(a) / "b" / "c.txt"   → path joining with / (no os.path.join strings)
write_text / read_text    → whole-file one-liners (verified)
mkdir(parents=True, exist_ok=True) → mkdir -p equivalent
.name/.stem/.suffix/.parent → path anatomy (verified 'todo.txt'/'todo'/'.txt')
.exists()/.stat()         → checks and metadata (verified)
glob("*.txt") / rglob     → shell-style matching; rglob recurses (verified)
open(path_obj)            → open() accepts Path directly; file objects iterate lazily
with open(...) as f       → guaranteed close via context manager (section 9)
encoding="utf-8"          → pass it explicitly; the default varies by platform
```

---

## 23. properties, classmethod & staticmethod

**`@property` — a method that LOOKS like an attribute.** Callers write `t.celsius`, no parentheses — but a function runs, so you can compute values on the fly and validate assignments, without ever changing the public interface.

```python
class Temperature:
    def __init__(self, celsius):
        self._celsius = celsius        # _prefix: "internal storage" by convention

    @property
    def celsius(self):                 # the GETTER — runs on t.celsius
        return self._celsius

    @celsius.setter
    def celsius(self, value):          # the SETTER — runs on t.celsius = x
        if value < -273.15:
            raise ValueError(f"below absolute zero: {value}")
        self._celsius = value

    @property
    def fahrenheit(self):              # computed property — no setter = READ-ONLY
        return self._celsius * 9 / 5 + 32
```
✅ Verified — attribute syntax, live computation, validation:
```python
t = Temperature(25)
t.celsius        # 25
t.fahrenheit     # 77.0  -- computed on access, always in sync
t.celsius = 100  # goes through the setter
t.fahrenheit     # 212.0 -- verified
```
❌ The setter validates; the computed property rejects writes entirely:
```python
t.celsius = -300
# ValueError: below absolute zero: -300
t.fahrenheit = 42
# AttributeError: property 'fahrenheit' of 'Temperature' object has no setter
```
✅ The Python idiom: start with a plain attribute; if you later need validation/computation, upgrade it to a property — callers don't change at all (in C++/Java you'd have had to write getters up front).

**`@classmethod` — receives the CLASS (`cls`), not an instance. The classic use: alternative constructors.**
```python
class Pizza:
    def __init__(self, toppings):
        self.toppings = toppings

    @classmethod
    def margherita(cls):               # named constructor
        return cls(["tomato", "mozzarella"])

    @classmethod
    def from_csv(cls, s):              # constructor from a different format
        return cls(s.split(","))

    @staticmethod
    def is_valid_topping(name):        # no self, no cls — just lives in the namespace
        return name not in ("pineapple",)
```
✅ Verified:
```python
Pizza.margherita().toppings        # ['tomato', 'mozzarella']
Pizza.from_csv("ham,mushroom").toppings   # ['ham', 'mushroom']
Pizza.is_valid_topping("ham")      # True
Pizza.is_valid_topping("pineapple")# False
```
**Why `cls` beats hardcoding the class name — inheritance does the right thing:**
```python
class Base:
    @classmethod
    def create(cls):
        return cls()          # cls is whoever the call came through
class Derived(Base): pass

type(Base.create()).__name__      # 'Base'    -- verified
type(Derived.create()).__name__   # 'Derived' -- verified: NOT Base!
```

Quick reference:
```
@property            → getter runs on plain attribute ACCESS (no parens) (verified)
@name.setter         → validation/side effects on assignment (verified ValueError)
property w/o setter  → read-only computed attribute (verified AttributeError on write)
@classmethod (cls)   → gets the class; alternative constructors; respects subclasses
                       (verified: Derived.create() builds a Derived)
@staticmethod        → no self/cls at all — a plain function namespaced in the class
which to use         → needs instance state: normal method | needs the class: classmethod
                       | needs neither: staticmethod (or a module-level function)
```

---

## 24. itertools Essentials — Lazy Iterator Building Blocks

Everything in `itertools` returns a LAZY iterator (the generator model from section 6) — nothing is computed until you iterate, and infinite sequences are fine as long as you slice them.

**Infinite generators — `count`, `cycle`, `repeat` (+ `islice` to take safely):**
```python
import itertools as it

list(it.islice(it.count(10, 5), 4))   # [10, 15, 20, 25] -- verified: start 10, step 5, take 4
list(it.repeat("ab", 3))              # ['ab', 'ab', 'ab'] -- verified

cycler = it.cycle("AB")               # A, B, A, B, ... forever
[next(cycler) for _ in range(5)]      # ['A', 'B', 'A', 'B', 'A'] -- verified
```
⚠️ `list(it.count())` hangs forever — always bound infinite iterators with `islice`/`take`-style limits. (Same lazy-infinite idea as C++20 `views::iota | take`, cpp summary section 37.)

**`chain` — concatenate any iterables without building a combined list:**
```python
list(it.chain([1, 2], "ab", (3,)))    # [1, 2, 'a', 'b', 3] -- verified
```

**The combinatorics trio:**
```python
list(it.product("AB", [1, 2]))     # [('A',1), ('A',2), ('B',1), ('B',2)]  -- cartesian, verified
list(it.permutations("ABC", 2))    # AB AC BA BC CA CB — ORDER MATTERS     -- verified
list(it.combinations("ABCD", 2))   # AB AC AD BC BD CD — order ignored     -- verified
```

**`groupby` — and its famous trap: it only groups CONSECUTIVE equal keys.**
```python
data = [("fruit", "apple"), ("veg", "carrot"), ("fruit", "banana")]

# ❌ unsorted input — the two 'fruit' runs become SEPARATE groups, and building a
# dict silently keeps only the LAST one; 'apple' is LOST:
{k: [v for _, v in g] for k, g in it.groupby(data, key=lambda t: t[0])}
# {'fruit': ['banana'], 'veg': ['carrot']}            -- verified: apple is gone!

# ✅ sort by the SAME key first:
data_sorted = sorted(data, key=lambda t: t[0])
{k: [v for _, v in g] for k, g in it.groupby(data_sorted, key=lambda t: t[0])}
# {'fruit': ['apple', 'banana'], 'veg': ['carrot']}   -- verified, correct
```
(For plain "group into a dict" jobs, `defaultdict(list)` from section 19 is often the simpler tool.)

**`zip_longest` — zip that doesn't stop at the shortest input:**
```python
list(it.zip_longest([1, 2, 3], "ab", fillvalue="-"))
# [(1, 'a'), (2, 'b'), (3, '-')] -- verified (plain zip would drop the 3)
```

Quick reference:
```
count(start, step) / cycle / repeat → infinite (or n-times) lazy sources
islice(it, n)                       → safe window into any iterator — REQUIRED for infinite ones
chain(a, b, c)                      → concatenation without building a merged list (verified)
product / permutations / combinations → cartesian / ordered / unordered selections (verified)
groupby(data, key)                  → groups CONSECUTIVE equal keys ONLY — must sort by the
                                      same key first (verified: unsorted input LOSES data)
zip_longest(..., fillvalue=x)       → zip padded to the LONGEST input (verified)
```

---

## 25. Generators Advanced — yield from, send, close & throw

**`yield from` — delegate to a sub-generator (and collect its return value).** Section 6 covered basic `yield`; `yield from` flattens nested generators and is the only way to capture what a generator `return`s.

```python
def inner():
    yield 1
    yield 2
    return "inner done"        # a generator CAN return a value — but it hides in StopIteration

def outer():
    result = yield from inner()    # yields 1, 2 through, THEN captures the return value
    yield f"got: {result}"

list(outer())   # [1, 2, 'got: inner done'] -- verified
```
The everyday use — flattening:
```python
def chain_gen(*iterables):
    for iterable in iterables:
        yield from iterable        # instead of: for x in iterable: yield x

list(chain_gen("ab", [1, 2], range(2)))   # ['a', 'b', 1, 2, 0, 1] -- verified
```

**`send()` — talking BACK into a paused generator.** `value = yield something` is two-way: the generator hands out `something`, then receives whatever the caller `send()`s as the value of the `yield` expression.

```python
def running_average():
    total, count = 0.0, 0
    avg = None
    while True:
        value = yield avg      # pause: emit current avg, wait to RECEIVE a value
        total += value
        count += 1
        avg = total / count

g = running_average()
next(g)          # None — PRIMING: run to the first yield before send() works -- verified
g.send(10)       # 10.0 -- verified
g.send(20)       # 15.0 -- verified
g.send(60)       # 30.0 -- verified: (10+20+60)/3 — state lives across calls
```
❌ Forgetting to prime (`next(g)` first) raises `TypeError: can't send non-None value to a just-started generator`. This send-based coroutine style is the ancestor of `async`/`await` (section 18).

**`close()` and `throw()` — controlling a generator from outside:**
```python
def worker():
    try:
        while True:
            yield "working"
    finally:
        print("cleanup ran (close/GC)")   # guaranteed on close, like __exit__

w = worker()
next(w)      # 'working'
w.close()    # prints: cleanup ran (close/GC) -- verified; generator is now finished
```
`throw()` raises an exception INSIDE the generator at the paused `yield`:
```python
g2 = running_average()
next(g2)
g2.throw(ValueError("injected"))
# ValueError: injected -- verified: propagates out (the generator didn't catch it)
```

Quick reference:
```
yield from sub          → delegate: passes values through AND captures sub's return value
                          (verified: return value only reachable via yield from)
generator return value  → rides inside StopIteration — invisible to for loops
yield from (flattening) → replaces 'for x in it: yield x' (verified chain example)
value = yield out       → two-way: emits out, receives the next send() (verified 10/15/30)
priming                 → must next(g) once before the first send() (else TypeError)
g.close()               → raises GeneratorExit inside; finally blocks run (verified)
g.throw(exc)            → injects an exception at the paused yield (verified propagation)
lineage                 → send-style coroutines are the ancestors of async/await (section 18)
```

---

## Quick Reference — Key Rules

```
dynamic typing            → names are bound to objects; type lives on the OBJECT, checked at runtime
duck typing                 → no declared interface needed -- just needs to support the operation used
                                (verified: describe(42) -> TypeError, only at the point of use)

is vs ==                      → is: same object (identity); ==: same value (equality) -- use == for values
mutable vs immutable            → list/dict/set/objects mutate in place; int/str/tuple make new objects
mutable default argument (def f(x=[]))  → built ONCE at def-time, shared across calls (verified) --
                                            use x=None, then `if x is None: x = []` instead

*args/**kwargs                       → collect extra positional/keyword args into a tuple/dict
*/** at a call site                     → UNPACKS a list/dict into a call's arguments
bare * in params (keyword-only)           → args after it CANNOT be positional (verified TypeError)
bare / in params (positional-only)          → args before it CANNOT be keyword (verified TypeError)

lambda params: expr                            → anonymous function, body MUST be one expression
                                                  (verified SyntaxError for assignment/return/statements)
naming a lambda (x = lambda: ...)                 → works but PEP 8-discouraged (verified flake8 E731)

[expr for x in it]                             → list comprehension, eager, builds the WHOLE result
(expr for x in it)                                → generator expression, lazy, tiny memory (verified)
comprehension loop variable                          → private, does NOT leak (verified, unlike a for-loop)
yield                                                   → pauses a function into a generator; next()
                                                           resumes it; exhausted generators stay
                                                           exhausted (verified) -- can't be "reset"

LEGB                                                        → Local -> Enclosing -> Global -> Built-in
nonlocal / global                                              → nonlocal: nearest enclosing function;
                                                                   global: module scope directly
assignment anywhere in a function                                 → makes that name LOCAL for the WHOLE
                                                                      function unless declared otherwise
                                                                      (verified UnboundLocalError)
late-binding closures in a loop                                       → captures the VARIABLE, not its
                                                                          value (verified [2,2,2]); fix
                                                                          with a default arg (verified [0,1,2])

@decorator                                                                → sugar for name = decorator(name)
functools.wraps                                                             → preserves __name__/__doc__
with / __enter__ / __exit__                                                   → guaranteed cleanup
__exit__ returning True                                                         → SWALLOWS the exception
contextlib.contextmanager                                                        → generator-based context
                                                                                     manager, less boilerplate

dunder methods                                                                       → Python's operator
                                                                                        overloading
__eq__ without __hash__                                                                → UNHASHABLE
                                                                                           (verified TypeError)
super() / MRO                                                                              → next class
                                                                                               in a fixed
                                                                                               linearized order
inconsistent base class order                                                                 → TypeError:
                                                                                                  no consistent
                                                                                                  MRO (verified)
ABC + @abstractmethod                                                                            → nominal
                                                                                                     typing;
                                                                                                     unimplemented
                                                                                                     abstract
                                                                                                     method blocks
                                                                                                     instantiation
typing.Protocol + @runtime_checkable                                                                → structural
                                                                                                         typing;
                                                                                                         missing the
                                                                                                         decorator
                                                                                                         breaks
                                                                                                         isinstance()
                                                                                                         (verified)

try/except/else/finally     → else only on success; finally always; except BaseClass catches subclasses
raise X from Y                 → chains exceptions, preserves the original as X.__cause__

type hints                        → documentation/tooling ONLY, never enforced at runtime (verified)
@dataclass                          → auto __init__/__repr__/__eq__; non-default field after a default
                                       field is a TypeError at class-definition time (verified)
field(default_factory=list)            → the dataclass-native fix for the mutable-default trap
@dataclass(frozen=True)                   → immutable; assigning raises FrozenInstanceError (verified)

lru_cache                                    → memoizes; verified 31 vs ~2.7M calls for fib(30)
partial                                         → pre-binds arguments, returns a narrower callable
reduce                                             → folds a sequence; empty seq + no initial value
                                                      is a TypeError (verified)

copy.copy (shallow)                                   → new outer container, SHARED nested objects
copy.deepcopy                                            → fully independent, recursive copy
slicing (a[:]) / list(a)                                    → ALSO only shallow (verified, same trap)

GIL                                                            → one thread runs Python bytecode at a time
threading                                                         → no CPU-bound speedup (verified ~1.0x);
                                                                      real I/O-bound speedup (verified ~2x)
multiprocessing                                                       → real CPU-bound parallelism via
                                                                          separate processes (verified ~1.9x)
asyncio                                                                  → cooperative I/O concurrency,
                                                                             single thread, scales further
exception inside a Thread                                                    → does NOT propagate to main
                                                                                 (verified) -- printed, swallowed
```
