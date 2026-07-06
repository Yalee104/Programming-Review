// Python quiz — questions map 1:1 to sections of python_study_summary.md
// level: "beginner" | "intermediate" | "advanced"
window.QUIZZES = window.QUIZZES || {};
window.QUIZZES.python = {
  title: "Python Quiz",
  sections: {
    1: "Dynamic Typing & Duck Typing",
    2: "Mutable vs Immutable Types, Identity vs Equality",
    3: "Function Arguments — *args / **kwargs, Keyword-Only & Positional-Only",
    4: "Lambda — Anonymous Inline Functions",
    5: "Comprehensions & Generator Expressions",
    6: "Iterators & Generators",
    7: "Closures & Scoping (the LEGB rule)",
    8: "Decorators",
    9: "Context Managers",
    10: "Dunder Methods — Python's Operator Overloading",
    11: "Inheritance, super(), MRO & the Diamond Problem, ABCs",
    12: "Structural Typing with typing.Protocol",
    13: "Exception Handling",
    14: "Type Hints & Dataclasses",
    15: "functools Essentials",
    16: "Slicing",
    17: "Copy Semantics: Shallow vs Deep",
    18: "The GIL, Threading, Multiprocessing & Asyncio"
  },
  questions: [
    // ---- Section 1
    {
      type: "mc",
      level: "beginner",
      q: "What happens when `describe(42)` runs?",
      code: "def describe(thing):\n    return f\"{thing!r} has length {len(thing)}\"\n\ndescribe(42)",
      choices: [
        "A `TypeError` is raised at runtime, at the moment `len(thing)` executes",
        "A compile-time error before the program runs",
        "It returns `\"42 has length 2\"`",
        "It returns `None` silently"
      ],
      answer: 0,
      explain: "Python uses duck typing: it never checks argument types up front. The failure only happens at runtime, exactly when the unsupported operation `len(42)` is attempted — unlike C++, where a type mismatch is usually caught by the compiler.",
      section: 1
    },
    {
      type: "mc",
      level: "beginner",
      q: "In Python, where does the **type** live?",
      choices: [
        "On the object — a variable is just a name bound to an object",
        "On the variable — each variable is declared with a fixed type",
        "On both the variable and the object, and they must match",
        "Nowhere — Python has no runtime type information"
      ],
      answer: 0,
      explain: "A name has no type; it can be rebound to an int, then a str, then a list. The object itself carries the type, checked at the moment an operation is attempted.",
      section: 1
    },

    // ---- Section 2
    {
      type: "mc",
      level: "beginner",
      q: "What is `a` after this code runs?",
      code: "a = [1, 2, 3]\nb = a\nb.append(4)",
      choices: [
        "`[1, 2, 3, 4]` — `a` and `b` are two names for the same list",
        "`[1, 2, 3]` — `b = a` made a copy",
        "`[1, 2, 3]` — lists are immutable",
        "It raises an error — you cannot append through an alias"
      ],
      answer: 0,
      explain: "`b = a` does NOT copy — it binds another name to the exact same list object. Mutating through either name changes the one shared list (`a is b` is True).",
      section: 2
    },
    {
      type: "mc",
      level: "beginner",
      q: "Which group lists only **immutable** types?",
      choices: [
        "`int`, `str`, `tuple`",
        "`list`, `dict`, `set`",
        "`int`, `list`, `str`",
        "`dict`, `tuple`, `set`"
      ],
      answer: 0,
      explain: "int, float, str, tuple (and frozenset) are immutable — any \"modification\" builds a brand-new object. list, dict, set and most custom objects are mutable and change in place, which is why aliasing matters for them.",
      section: 2
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why is `def append_item(item, bucket=[])` dangerous?",
      choices: [
        "The default `[]` is created once at `def` time and shared across all calls",
        "Empty lists are not allowed as default values",
        "It raises a `TypeError` on the second call",
        "The list is re-created on every call, which is slow"
      ],
      answer: 0,
      explain: "Default values are evaluated exactly once, when the `def` statement runs. Every call that omits `bucket` shares that same growing list ([1], then [1, 2], …). Fix: default to `None` and create a fresh list inside the body.",
      section: 2
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which operator checks whether two names refer to the **same object in memory** (identity, not value)?",
      accept: ["is"],
      answerDisplay: "`is`",
      explain: "`is` compares identity (same object), `==` compares values. Use `==` for value comparisons and reserve `is` for identity checks like `x is None` — small-int caching makes `is` look like it works for numbers, but that is an implementation detail.",
      section: 2
    },
    {
      type: "mc",
      level: "advanced",
      q: "Both values are computed at runtime. What does `x2 is y2` evaluate to?",
      code: "x2 = (lambda n: n * 2)(500)   # 1000\ny2 = (lambda n: n * 2)(500)   # 1000\nx2 is y2   # ?",
      choices: [
        "`False` — 1000 is outside CPython's small-int cache, so these are two different objects",
        "`True` — equal ints are always the same object",
        "`True` — CPython caches all integers",
        "It raises a `TypeError`"
      ],
      answer: 0,
      explain: "CPython caches only small ints (-5 to 256) as an implementation detail, so `is` can LOOK like it compares values — then silently breaks for larger numbers. `x2 == y2` is True but `x2 is y2` is False. Always use `==` for values.",
      section: 2
    },

    // ---- Section 3
    {
      type: "mc",
      level: "beginner",
      q: "What does `*args` collect, and into what?",
      code: "def summary(*args, **kwargs):\n    ...\n\nsummary(1, 2, 3, name=\"Aaron\")",
      choices: [
        "Extra positional arguments, into a tuple — here `(1, 2, 3)`",
        "Extra keyword arguments, into a dict",
        "All arguments, into a list",
        "Only the first argument"
      ],
      answer: 0,
      explain: "`*args` collects extra POSITIONAL arguments into a tuple; `**kwargs` collects extra KEYWORD arguments into a dict — here `{'name': 'Aaron'}`. At a call site the same syntax unpacks instead.",
      section: 3
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Given the signature below, what does `connect(\"localhost\", 9090)` do?",
      code: "def connect(host, *, port=8080, timeout=30):\n    return f\"{host}:{port}\"",
      choices: [
        "Raises `TypeError` — everything after the bare `*` must be passed by keyword",
        "Returns `\"localhost:9090\"`",
        "Returns `\"localhost:8080\"`, ignoring the 9090",
        "Raises `SyntaxError` at definition time"
      ],
      answer: 0,
      explain: "The bare `*` makes every parameter after it keyword-only. `connect` accepts only one positional argument (`host`), so a second positional argument raises TypeError. You must write `connect(\"localhost\", port=9090)`.",
      section: 3
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `divide(a=10, b=2)` do here?",
      code: "def divide(a, b, /):\n    return a / b",
      choices: [
        "Raises `TypeError` — parameters before the bare `/` are positional-only",
        "Returns `5.0`",
        "Raises `SyntaxError` at definition time",
        "Returns `0.2` — keyword args reverse the order"
      ],
      answer: 0,
      explain: "The bare `/` (Python 3.8+) makes everything BEFORE it positional-only. Even though `a` and `b` are the real parameter names, passing them as keywords raises TypeError. `divide(10, 2)` works fine.",
      section: 3
    },
    {
      type: "fill",
      level: "beginner",
      q: "`**kwargs` collects extra keyword arguments into what built-in type? (one word)",
      accept: ["dict", "a dict", "dictionary", "a dictionary"],
      answerDisplay: "a `dict`",
      explain: "`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict. The same `*`/`**` syntax at a call site does the reverse — it unpacks.",
      section: 3
    },

    // ---- Section 4
    {
      type: "mc",
      level: "beginner",
      q: "What is `square(5)`, and what is the lambda equivalent to?",
      code: "square = lambda x: x * x",
      choices: [
        "`25` — exactly equivalent to `def square(x): return x * x`",
        "`10` — lambda doubles its argument",
        "A `SyntaxError` — lambdas need a return statement",
        "`<lambda>` — it can't be called without `def`"
      ],
      answer: 0,
      explain: "`lambda params: expr` is an anonymous function equivalent to a def whose body is `return expr`. Both forms verified to give 25. (PEP 8 discourages NAMING a lambda like this though — if it's worth a name, use def.)",
      section: 4
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which of these is **not allowed** inside a lambda body?",
      choices: [
        "An assignment statement like `y = x + 1`",
        "A conditional expression like `\"even\" if x % 2 == 0 else \"odd\"`",
        "`*args` and `**kwargs` parameters",
        "Default parameter values like `lambda name, greeting=\"hello\": ...`"
      ],
      answer: 0,
      explain: "A lambda body must be exactly ONE expression. Assignments, `return`, `if` blocks and loops are statements, so they are a SyntaxError inside a lambda. A conditional expression (`a if cond else b`) is fine because it is an expression.",
      section: 4
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does this return?",
      code: "names = [\"Charlie\", \"alice\", \"Bob\"]\nsorted(names, key=lambda s: s.lower())",
      choices: [
        "`['alice', 'Bob', 'Charlie']` — sorted by the lowercase form of each name",
        "`['Bob', 'Charlie', 'alice']` — same as the default sort",
        "`['alice', 'bob', 'charlie']` — the names are converted to lowercase",
        "A `TypeError` — key functions can't be lambdas"
      ],
      answer: 0,
      explain: "`key=` computes a sort key per element without changing the elements — here the lowercase form, giving a case-insensitive order. The default sort is case-sensitive (uppercase before lowercase), giving ['Bob', 'Charlie', 'alice'].",
      section: 4
    },

    // ---- Section 5
    {
      type: "mc",
      level: "beginner",
      q: "What is `squares`?",
      code: "squares = [x*x for x in range(6)]",
      choices: [
        "`[0, 1, 4, 9, 16, 25]`",
        "`[1, 4, 9, 16, 25, 36]`",
        "`[0, 1, 2, 3, 4, 5]`",
        "A generator object"
      ],
      answer: 0,
      explain: "A list comprehension eagerly builds the whole list: x*x for x = 0..5 gives [0, 1, 4, 9, 16, 25]. range(6) stops before 6, and square brackets mean list (round parens would make a lazy generator).",
      section: 5
    },
    {
      type: "mc",
      level: "beginner",
      q: "What does `type({})` return?",
      choices: [
        "`<class 'dict'>` — empty braces make an empty dict, not a set",
        "`<class 'set'>`",
        "`SyntaxError`",
        "`<class 'frozenset'>`"
      ],
      answer: 0,
      explain: "`{}` is an empty DICT. There is no literal for an empty set — you must write `set()` explicitly. `{1, 2}` with elements is a set, but empty braces belong to dict.",
      section: 5
    },
    {
      type: "fill",
      level: "intermediate",
      q: "There is no literal for an empty set. What do you write to create one?",
      accept: ["set()", "set"],
      answerDisplay: "`set()`",
      explain: "`{}` is an empty dict, so the only way to make an empty set is calling `set()`. Verified: `type({})` is dict, `type(set())` is set.",
      section: 5
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is the key difference between `[x*x for x in range(10**6)]` and `(x*x for x in range(10**6))`?",
      choices: [
        "The `()` version is lazy — values are computed one at a time on demand, using tiny memory",
        "The `()` version builds a tuple instead of a list",
        "They are identical except for the result type",
        "The `()` version is eager but faster"
      ],
      answer: 0,
      explain: "Square brackets build the entire list immediately in memory (~800KB for 100k ints). Parentheses create a generator expression — a paused computation of ~104 bytes that produces values only when asked via `next()` or iteration.",
      section: 5
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is `x` after this code runs?",
      code: "x = \"before\"\nsquares = [x for x in range(3)]",
      choices: [
        "`\"before\"` — a comprehension's loop variable has its own private scope",
        "`2` — the loop variable leaks like a regular for loop",
        "`[0, 1, 2]`",
        "`NameError` — x was consumed by the comprehension"
      ],
      answer: 0,
      explain: "In Python 3 a comprehension has its own scope, so its loop variable does NOT leak out. Contrast with a plain `for x in range(3):` loop, whose variable DOES remain in the enclosing scope afterwards (it would be 2).",
      section: 5
    },
    {
      type: "mc",
      level: "advanced",
      q: "Roughly what does `sys.getsizeof` report for these two, and why?",
      code: "import sys\nsys.getsizeof([x*x for x in range(100000)])   # ?\nsys.getsizeof((x*x for x in range(100000)))   # ?",
      choices: [
        "~800,984 bytes vs ~104 bytes — the generator never materializes the sequence",
        "About the same — both store 100,000 results",
        "The generator is bigger — it stores extra bookkeeping",
        "Both are ~104 bytes — getsizeof ignores contents"
      ],
      answer: 0,
      explain: "Verified: the list comprehension materializes all 100k values (~800KB); the generator expression is a tiny paused object (~104 bytes) REGARDLESS of the range size — the whole sequence never has to exist in memory at once.",
      section: 5
    },

    // ---- Section 6
    {
      type: "mc",
      level: "beginner",
      q: "What happens the moment you call `countdown(3)`?",
      code: "def countdown(n):\n    print(f\"starting from {n}\")\n    while n > 0:\n        yield n\n        n -= 1\n\ngen = countdown(3)   # what prints here?",
      choices: [
        "Nothing prints — the body doesn't run until the first `next(gen)`",
        "It prints \"starting from 3\" immediately",
        "It prints all three values at once",
        "It raises StopIteration"
      ],
      answer: 0,
      explain: "A function containing `yield` returns a paused generator object immediately — the body hasn't run at all. Each `next()` resumes from where it left off up to the next `yield`. Verified: the print only appears on the first `next(gen)`.",
      section: 6
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does the second `list(g)` return?",
      code: "def gen3():\n    yield 1\n    yield 2\n\ng = gen3()\nlist(g)   # [1, 2]\nlist(g)   # ???",
      choices: [
        "`[]` — a generator can only be consumed once and stays exhausted",
        "`[1, 2]` — generators restart automatically",
        "`StopIteration` is raised",
        "`[2]` — it resumes from the last yield"
      ],
      answer: 0,
      explain: "Once a generator's body finishes, it is exhausted forever — further iteration just yields nothing. To iterate again you must call the generator function again (`gen3()`) to get a brand-new generator object.",
      section: 6
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which exception does `next()` raise when a generator (or any iterator) has no more values?",
      accept: ["stopiteration", "StopIteration"],
      answerDisplay: "`StopIteration`",
      explain: "`StopIteration` is how the iterator protocol signals \"the loop ends\". A `for` loop calls `next()` for you and stops cleanly when it catches this exception — you never see it inside a for loop.",
      section: 6
    },

    // ---- Section 7
    {
      type: "mc",
      level: "advanced",
      q: "What does `[f() for f in funcs]` return?",
      code: "funcs = []\nfor i in range(3):\n    funcs.append(lambda: i)",
      choices: [
        "`[2, 2, 2]` — each lambda looks up the variable `i` when called, after the loop ended",
        "`[0, 1, 2]` — each lambda remembers the value at creation",
        "`[0, 0, 0]` — lambdas capture the first value",
        "`NameError` — i no longer exists when the lambdas run"
      ],
      answer: 0,
      explain: "Closures are late-binding: the lambda captures the VARIABLE `i`, not its value at creation time. By the time any lambda runs, the loop is over and `i` is 2. Fix: `lambda i=i: i` — default arguments are evaluated at creation time, capturing the current value.",
      section: 7
    },
    {
      type: "mc",
      level: "advanced",
      q: "This is `make_counter` with `nonlocal` removed. What happens when the returned function is called?",
      code: "def make_counter_broken():\n    count = 0\n    def increment():\n        count += 1     # no nonlocal\n        return count\n    return increment\n\nmake_counter_broken()()",
      choices: [
        "`UnboundLocalError` — assigning to `count` makes it local for the WHOLE body, including the read in `count += 1`",
        "It works — `count` is found in the enclosing scope",
        "`NameError: count is not defined`",
        "It returns 0"
      ],
      answer: 0,
      explain: "Any name assigned anywhere in a function is treated as LOCAL for the entire body — even on lines before the assignment. `count += 1` must READ the local `count` before it has a value → UnboundLocalError. `nonlocal count` tells Python to use the enclosing function's variable instead.",
      section: 7
    },
    {
      type: "fill",
      level: "intermediate",
      q: "Which keyword lets a nested function **assign** to a variable in its enclosing function's scope (not module scope)?",
      accept: ["nonlocal"],
      answerDisplay: "`nonlocal`",
      explain: "Without `nonlocal`, assigning to a name makes it local for the whole function body, so `count += 1` raises UnboundLocalError. `nonlocal` targets the nearest enclosing function scope; `global` skips straight to module scope.",
      section: 7
    },

    // ---- Section 8
    {
      type: "mc",
      level: "beginner",
      q: "`@log_calls` written above `def add(...)` is exactly equivalent to what?",
      choices: [
        "`add = log_calls(add)` after the def",
        "`add = log_calls(add())` — calling add first",
        "Registering `add` in a global decorator table",
        "`log_calls.add = add`"
      ],
      answer: 0,
      explain: "Decorator syntax is pure sugar: the function is defined, then passed through the decorator, and the result is rebound to the same name. A decorator is just a function that takes a function and returns a (usually wrapped) function.",
      section: 8
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is `@functools.wraps(func)` for inside a decorator?",
      choices: [
        "It preserves the wrapped function's `__name__` and `__doc__` on the wrapper",
        "It makes the wrapper run faster by caching results",
        "It is required or the decorator raises a TypeError",
        "It automatically forwards `*args` and `**kwargs`"
      ],
      answer: 0,
      explain: "The wrapper function replaces the original entirely, so without `wraps` the decorated function's `__name__` becomes \"wrapper\" and its docstring is lost. `functools.wraps` copies the original's metadata onto the wrapper.",
      section: 8
    },
    {
      type: "mc",
      level: "advanced",
      q: "A decorator that takes its own arguments, like `@repeat(3)`, needs how many levels of nested functions?",
      code: "@repeat(3)\ndef greet(name): return f\"hello {name}\"\n\ngreet(\"Aaron\")   # ['hello Aaron', 'hello Aaron', 'hello Aaron']",
      choices: [
        "Three — a factory taking the args, returning the decorator, returning the wrapper",
        "Two — the decorator and the wrapper",
        "One — the decorator itself takes both the args and the function",
        "Zero — Python handles the arguments automatically"
      ],
      answer: 0,
      explain: "`repeat(3)` is a CALL that must return the actual decorator, which then receives `greet` and returns the wrapper: `def repeat(n): def decorator(func): def wrapper(*a, **k): ... return wrapper; return decorator`. One extra level compared to a plain decorator.",
      section: 8
    },

    // ---- Section 9
    {
      type: "mc",
      level: "intermediate",
      q: "An exception is raised INSIDE a `with` block. Does `__exit__` still run?",
      code: "with ManagedResource(\"file B\") as r:\n    raise ValueError(\"boom\")",
      choices: [
        "Yes — `__exit__` always runs, even before any outer `except` catches the exception",
        "No — the exception skips cleanup entirely",
        "Only if the `with` has an `else` clause",
        "Only for built-in resource types like files"
      ],
      answer: 0,
      explain: "That's the whole point of `with`: cleanup is guaranteed no matter how the block exits. Verified: \"releasing file B\" prints BEFORE the outer except catches the ValueError. `__exit__` receives the exception info as arguments.",
      section: 9
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What happens when `__exit__` returns `True` after an exception was raised inside the `with` block?",
      choices: [
        "The exception is swallowed — it never propagates past the with block",
        "The exception is re-raised with extra context",
        "Python calls `__exit__` a second time",
        "The exception becomes a warning"
      ],
      answer: 0,
      explain: "`__exit__`'s return value decides the exception's fate: truthy = suppress it entirely, falsy (or no return) = let it propagate normally. Suppression is occasionally useful but surprising, so returning False is the usual choice.",
      section: 9
    },
    {
      type: "mc",
      level: "intermediate",
      q: "In a `@contextlib.contextmanager` generator, which part plays the role of `__exit__`?",
      code: "@contextlib.contextmanager\ndef managed(name):\n    print(\"acquiring\")      # A\n    try:\n        yield name          # B\n    finally:\n        print(\"releasing\")  # C",
      choices: [
        "C — the code after the yield (in the finally) runs as cleanup",
        "A — the code before the yield",
        "B — the yield itself",
        "None; contextmanager generators have no __exit__ equivalent"
      ],
      answer: 0,
      explain: "Everything before `yield` is `__enter__`, the yielded value becomes the `as` variable, and everything after the yield — placed in a `finally` so it runs even if the body raises — is `__exit__`.",
      section: 9
    },

    // ---- Section 10
    {
      type: "mc",
      level: "beginner",
      q: "Which dunder method does `print(obj)` use, and which is meant for developers instead?",
      choices: [
        "`print` uses `__str__` (users); `__repr__` is the unambiguous one for developers",
        "`print` uses `__repr__`; `__str__` is for developers",
        "`print` uses `__format__` only",
        "Both are aliases of each other"
      ],
      answer: 0,
      explain: "`__str__` is the readable, user-facing form used by `str()`/`print()`. `__repr__` is the unambiguous developer-facing form used by `repr()` and the interactive shell — and it is the fallback if `__str__` is undefined.",
      section: 10
    },
    {
      type: "mc",
      level: "advanced",
      q: "A class defines `__eq__` but not `__hash__`. What happens when you put an instance into a set?",
      choices: [
        "`TypeError: unhashable type` — customizing __eq__ removes the default hash",
        "It works, using the default identity-based hash",
        "It works, hashing the object's attributes automatically",
        "The set silently stores duplicates"
      ],
      answer: 0,
      explain: "Python assumes that if you customized equality, the default identity-based hash would be inconsistent with it (equal objects must hash equal), so it sets `__hash__` to None. Define `__hash__` alongside `__eq__` — e.g. `hash((self.x, self.y))`.",
      section: 10
    },
    {
      type: "mc",
      level: "intermediate",
      q: "A class defines `__getitem__` but NOT `__iter__`. What surprising thing still works?",
      code: "class Vec2:\n    def __getitem__(self, index):\n        return (self.x, self.y)[index]\n\nfor v in Vec2(1, 2):   # ?\n    print(v)",
      choices: [
        "Iteration — Python tries `a[0]`, `a[1]`, … until IndexError (legacy protocol)",
        "Nothing — iteration requires `__iter__`",
        "Only `len()` works",
        "It loops forever"
      ],
      answer: 0,
      explain: "`__getitem__` alone makes an object iterable via the legacy protocol that predates `__iter__`/`__next__`: the for loop calls a[0], a[1], a[2]… and stops automatically at IndexError. Verified: prints 1 then 2.",
      section: 10
    },

    // ---- Section 11
    {
      type: "mc",
      level: "advanced",
      q: "What does `D().who()` return with this diamond hierarchy?",
      code: "class A:\n    def who(self): return \"A\"\nclass B(A):\n    def who(self): return f\"B -> {super().who()}\"\nclass C(A):\n    def who(self): return f\"C -> {super().who()}\"\nclass D(B, C):\n    def who(self): return f\"D -> {super().who()}\"",
      choices: [
        "`\"D -> B -> C -> A\"` — the MRO visits each class exactly once",
        "`\"D -> B -> A\"` — super() means direct parent",
        "`\"D -> B -> A -> C -> A\"` — A runs twice",
        "`TypeError` — diamond inheritance is not allowed"
      ],
      answer: 0,
      explain: "`super()` does NOT mean \"my parent\" — it means the NEXT class in the MRO (C3 linearization): D → B → C → A → object. Each class is visited exactly once; B's super() is C here, not A. Check with `D.__mro__`.",
      section: 11
    },
    {
      type: "mc",
      level: "advanced",
      q: "Given `class B(A)`, what happens when you define `class C(A, B)`?",
      choices: [
        "`TypeError: Cannot create a consistent method resolution order` — the base order contradicts B inheriting from A",
        "It works; A's methods win over B's",
        "It works; Python silently reorders the bases",
        "`SyntaxError` — you can't list two related bases"
      ],
      answer: 0,
      explain: "Listing A before B says \"A comes first\", but B(A) requires A to come AFTER B in the MRO. Python refuses to guess and raises TypeError at class-definition time. `class C(B, A)` is fine — it's consistent with the existing hierarchy.",
      section: 11
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What happens when you instantiate `Shape()` here?",
      code: "from abc import ABC, abstractmethod\n\nclass Shape(ABC):\n    @abstractmethod\n    def area(self): ...",
      choices: [
        "`TypeError` — a class with an unimplemented abstractmethod cannot be instantiated",
        "It works; area() just raises NotImplementedError when called",
        "It works; area() returns None",
        "`SyntaxError` at class definition"
      ],
      answer: 0,
      explain: "ABCs enforce nominal typing at instantiation time: any class with unimplemented `@abstractmethod`s cannot be constructed. A subclass that implements `area()` (like a `Circle`) can be instantiated normally.",
      section: 11
    },

    // ---- Section 12
    {
      type: "mc",
      level: "advanced",
      q: "How does `typing.Protocol` differ from an ABC?",
      choices: [
        "Protocol is structural — matching method signatures alone count, no inheritance needed",
        "Protocol requires explicit inheritance, ABC does not",
        "Protocol only works with dataclasses",
        "There is no difference; Protocol is an alias of ABC"
      ],
      answer: 0,
      explain: "ABC is NOMINAL typing (must explicitly inherit); Protocol is STRUCTURAL typing — duck typing formalized. A class matches `HasArea` just by having an `area()` method. For `isinstance()` checks, the protocol must also be decorated with `@runtime_checkable`.",
      section: 12
    },
    {
      type: "mc",
      level: "advanced",
      q: "The protocol below is missing a decorator. What does the `isinstance` check do?",
      code: "class HasArea(Protocol):        # no decorator\n    def area(self) -> float: ...\n\nisinstance(Circle(), HasArea)",
      choices: [
        "`TypeError` — isinstance only works with `@runtime_checkable` protocols",
        "`True` if Circle has an area() method",
        "`False` always",
        "It works but is slow"
      ],
      answer: 0,
      explain: "isinstance()/issubclass() checks against a Protocol require the `@runtime_checkable` decorator — without it, the check itself raises TypeError: \"Instance and class checks can only be used with @runtime_checkable protocols\".",
      section: 12
    },

    // ---- Section 13
    {
      type: "mc",
      level: "beginner",
      q: "In `try/except/else/finally`, when does the `else` block run?",
      choices: [
        "Only if the try block raised no exception",
        "Always, after the try block",
        "Only if an exception was caught",
        "Only if finally did not run"
      ],
      answer: 0,
      explain: "`else` runs only on the success path (no exception in `try`). `finally` always runs — success, caught exception, or even an uncaught one flying past.",
      section: 13
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which clause of `try/except/else/finally` is guaranteed to run no matter what — success, caught exception, or uncaught exception?",
      accept: ["finally"],
      answerDisplay: "`finally`",
      explain: "`finally` ALWAYS runs — there are no exceptions to this rule. Verified: it fires on the success path, after a caught ZeroDivisionError, and after a caught ValueError alike.",
      section: 13
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `raise AppError(...) from original` accomplish?",
      choices: [
        "It chains exceptions — the original is preserved as the new exception's `__cause__`",
        "It suppresses the original exception entirely",
        "It re-raises the original exception unchanged",
        "It converts the original into a warning"
      ],
      answer: 0,
      explain: "`raise X from Y` lets you re-raise as a more meaningful exception type without losing the root cause: the original stays inspectable as `X.__cause__`, and tracebacks show \"The above exception was the direct cause of...\".",
      section: 13
    },

    // ---- Section 14
    {
      type: "mc",
      level: "beginner",
      q: "Given `def add(a: int, b: int) -> int`, what does `add(\"foo\", \"bar\")` do when run?",
      choices: [
        "Returns `\"foobar\"` — Python never enforces type hints at runtime",
        "Raises `TypeError` because the hints are violated",
        "Raises a warning but returns the result",
        "Returns `None`"
      ],
      answer: 0,
      explain: "Type hints are documentation for tooling (mypy, editors) checked STATICALLY — the interpreter ignores them completely. Since `str` supports `+`, the call simply succeeds. A type checker would flag it, but only before/outside execution.",
      section: 14
    },
    {
      type: "mc",
      level: "beginner",
      q: "Which three methods does `@dataclass` auto-generate from the annotated fields?",
      code: "@dataclass\nclass Point:\n    x: int\n    y: int",
      choices: [
        "`__init__`, `__repr__`, and `__eq__`",
        "`__init__`, `__hash__`, and `__str__`",
        "`__new__`, `__del__`, and `__eq__`",
        "Only `__init__`"
      ],
      answer: 0,
      explain: "`@dataclass` generates `__init__` (from the fields), `__repr__` (Point(x=1, y=2)), and `__eq__` (field-by-field comparison) — verified: `Point(1,2) == Point(1,2)` is True.",
      section: 14
    },
    {
      type: "mc",
      level: "intermediate",
      q: "In a `@dataclass`, why write `tags: list = field(default_factory=list)` instead of `tags: list = []`?",
      choices: [
        "`default_factory` calls `list()` fresh for every instance, avoiding a shared mutable default",
        "It is only a style preference; both behave identically",
        "`field()` makes the attribute read-only",
        "`[]` would be a SyntaxError in a dataclass"
      ],
      answer: 0,
      explain: "This is the dataclass-native fix for the mutable-default trap: with a plain `[]` every instance would share ONE list (dataclasses actually refuse it with a ValueError). `default_factory=list` builds a new independent list per instance.",
      section: 14
    },
    {
      type: "mc",
      level: "advanced",
      q: "When does this error fire, and what is it?",
      code: "@dataclass\nclass Bad:\n    x: int = 1\n    y: int          # no default, after a defaulted field",
      choices: [
        "`TypeError: non-default argument 'y' follows default argument` — at class DEFINITION time, before any instantiation",
        "`TypeError` — but only when you first call `Bad()`",
        "No error — y just defaults to None",
        "`SyntaxError` when the file is parsed"
      ],
      answer: 0,
      explain: "Dataclass fields become `__init__` parameters in order, and Python function signatures forbid a non-default parameter after a defaulted one. The generated `__init__` would be invalid, so the TypeError is raised immediately when the class body is defined.",
      section: 14
    },

    // ---- Section 15
    {
      type: "fill",
      level: "intermediate",
      q: "Which `functools` decorator memoizes a function so repeated calls with the same arguments return a cached result?",
      accept: ["lru_cache", "functools.lru_cache", "@lru_cache", "@functools.lru_cache", "cache", "functools.cache"],
      answerDisplay: "`functools.lru_cache` (or `functools.cache`)",
      explain: "`@functools.lru_cache(maxsize=None)` remembers each unique set of arguments. It turns naive recursive fib(30) from ~2.7 million calls into just 31 — exponential to linear.",
      section: 15
    },
    {
      type: "mc",
      level: "advanced",
      q: "What does `functools.reduce(lambda acc, x: acc + x, [])` do?",
      choices: [
        "Raises `TypeError` — empty iterable with no initial value",
        "Returns `0`",
        "Returns `None`",
        "Returns `[]`"
      ],
      answer: 0,
      explain: "With no initial value and an empty sequence there is nothing to start folding from, so reduce refuses to guess. Passing an explicit initial value — `reduce(f, [], 0)` — returns 0 and safely handles the empty case.",
      section: 15
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What are `square(5)` and `cube(5)`?",
      code: "def power(base, exponent): return base ** exponent\nsquare = functools.partial(power, exponent=2)\ncube = functools.partial(power, exponent=3)",
      choices: [
        "`25` and `125` — partial pre-fills `exponent`, returning narrower callables",
        "`10` and `15` — partial multiplies",
        "A `TypeError` — power still needs both arguments",
        "Two unevaluated partial objects that can't be called"
      ],
      answer: 0,
      explain: "`functools.partial(func, **preset)` pre-binds some arguments and hands back a new callable needing only the rest. `square(5)` runs `power(5, exponent=2)` → 25; `cube(5)` → 125. Verified.",
      section: 15
    },

    // ---- Section 16
    {
      type: "mc",
      level: "beginner",
      q: "For `a = [0,1,2,3,4,5,6,7,8,9]`, what is `a[2:5]`?",
      choices: [
        "`[2, 3, 4]` — start included, stop excluded",
        "`[2, 3, 4, 5]` — both ends included",
        "`[3, 4, 5]` — start excluded",
        "`[2, 5]` — just the two endpoints"
      ],
      answer: 0,
      explain: "`seq[start:stop]` includes `start` and stops right BEFORE `stop` — so indices 2, 3, 4. Omitted pieces have defaults: `a[:4]` starts at 0, `a[6:]` runs to the end, `a[:]` copies the whole list.",
      section: 16
    },
    {
      type: "mc",
      level: "beginner",
      q: "For `a = list(range(10))`, what does `a[100:200]` return?",
      choices: [
        "`[]` — out-of-range slice bounds are silently clamped, never an error",
        "`IndexError: list index out of range`",
        "`None`",
        "`[9]` — it wraps around"
      ],
      answer: 0,
      explain: "Slices clamp to what actually exists (so `a[3:1000]` just goes to the end). This is a deliberate difference from single-element indexing: `a[100]` DOES raise IndexError.",
      section: 16
    },
    {
      type: "fill",
      level: "beginner",
      q: "Write the slice expression that returns list `a` reversed.",
      accept: ["a[::-1]", "[::-1]", "a[:: -1]", "a[::- 1]"],
      answerDisplay: "`a[::-1]`",
      explain: "A step of -1 walks backward through the whole sequence. It works on any sequence type and returns the same type (list in, list out; str in, str out).",
      section: 16
    },
    {
      type: "mc",
      level: "advanced",
      q: "You slice a NumPy array: `s = arr[1:4]`, then run `s[0] = 999`. What happened to `arr`?",
      choices: [
        "`arr` changed too — NumPy slices are VIEWS sharing the same memory",
        "`arr` is unchanged — slicing always copies in Python",
        "`TypeError` — NumPy slices are read-only",
        "`arr` was resized to 3 elements"
      ],
      answer: 0,
      explain: "Unlike `list`/`tuple`/`str`/`array.array` slicing (which copies), NumPy slicing returns a view into the same buffer — `np.shares_memory(arr, s)` is True. Call `.copy()` on the slice if you need independence. Critical gotcha for ML work.",
      section: 16
    },
    {
      type: "mc",
      level: "advanced",
      q: "What is `a` after this slice assignment?",
      code: "a = [1, 2, 3, 4, 5]\na[1:3] = [10, 20, 30]",
      choices: [
        "`[1, 10, 20, 30, 4, 5]` — the list GREW; slice assignment can change the length",
        "`[1, 10, 20, 4, 5]` — the third value is dropped",
        "`ValueError` — replacement must be the same length",
        "`[10, 20, 30, 4, 5]`"
      ],
      answer: 0,
      explain: "Slice assignment replaces the range with WHATEVER you supply — 2 elements replaced by 3, so the list grows. Related idioms: `a[1:4] = []` deletes the range, and `a[i:i] = [...]` is pure insertion at position i.",
      section: 16
    },

    // ---- Section 17
    {
      type: "mc",
      level: "intermediate",
      q: "After this code, what is `original`?",
      code: "import copy\noriginal = [[1, 2], [3, 4]]\nshallow = copy.copy(original)\nshallow[0].append(99)",
      choices: [
        "`[[1, 2, 99], [3, 4]]` — the inner lists are shared with the shallow copy",
        "`[[1, 2], [3, 4]]` — copies are always independent",
        "`[[1, 2], [3, 4], 99]`",
        "`AttributeError` — you cannot mutate through a copy"
      ],
      answer: 0,
      explain: "A shallow copy makes a new OUTER list, but the nested objects inside are the SAME objects (`original[0] is shallow[0]`). Mutating a nested list through the copy changes the original too. `copy.deepcopy` duplicates recursively; note `a[:]` and `list(a)` are also only shallow.",
      section: 17
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Is `b = a[:]` a deep copy?",
      code: "a = [[1], [2]]\nb = a[:]\nb[0].append(\"x\")\n# a == ?",
      choices: [
        "No — slicing is only a SHALLOW copy; `a` becomes `[[1, 'x'], [2]]`",
        "Yes — `a` stays `[[1], [2]]`",
        "Neither — `a[:]` returns the same object as `a`",
        "It raises an error"
      ],
      answer: 0,
      explain: "`a[:]` (and `list(a)`) copy only the OUTER list — the nested lists are shared, exactly like `copy.copy`. Verified: mutating `b[0]` changes `a[0]` too. Only `copy.deepcopy` duplicates all the way down. Shallow copies are safe only for flat lists of immutable values.",
      section: 17
    },

    // ---- Section 18
    {
      type: "mc",
      level: "intermediate",
      q: "Why does running CPU-bound Python code on 2 threads give ~1.0x speedup (i.e. none)?",
      choices: [
        "The GIL lets only one thread execute Python bytecode at a time",
        "Thread creation overhead cancels out the gains",
        "Python threads are green threads that never use a second core",
        "It actually gives 2x; the summary measured it wrong"
      ],
      answer: 0,
      explain: "CPython's Global Interpreter Lock serializes bytecode execution, so CPU-bound threads just take turns (measured 1.00x). Use `multiprocessing` for CPU-bound work (separate processes, separate GILs — measured ~1.9x on 2 cores). Threading still helps I/O-bound work because the GIL is released during I/O waits.",
      section: 18
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Threading DID give a ~2x speedup for `time.sleep`-style I/O work. Why, despite the GIL?",
      choices: [
        "CPython releases the GIL while a thread is blocked on I/O, letting another thread run",
        "sleep() doesn't count as Python code",
        "The GIL only applies to the main thread",
        "The measurement was wrong"
      ],
      answer: 0,
      explain: "The GIL serializes Python BYTECODE, but a thread waiting on I/O (network, disk, sleep) releases it, so other threads run during the wait. Verified: two 0.3s sleeps finish in ~0.301s on two threads vs 0.601s sequentially. CPU-bound: use multiprocessing; I/O-bound: threading or asyncio.",
      section: 18
    },
    {
      type: "mc",
      level: "advanced",
      q: "An unhandled exception is raised inside a `threading.Thread`. What does the main thread see?",
      choices: [
        "Nothing — a traceback is printed to stderr but no exception propagates to main",
        "The same exception re-raised at `t.join()`",
        "A `ThreadError` wrapping the original",
        "The whole process exits immediately"
      ],
      answer: 0,
      explain: "Thread exceptions do NOT propagate — they are printed by the default thread exception hook and swallowed; the main program continues normally. To detect failures, use `concurrent.futures.ThreadPoolExecutor`, whose `.result()` re-raises the exception.",
      section: 18
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which tool gets I/O-bound concurrency on a **single thread**, with tasks voluntarily yielding at `await` points?",
      choices: [
        "`asyncio`",
        "`multiprocessing`",
        "`threading`",
        "The GIL"
      ],
      answer: 0,
      explain: "asyncio uses cooperative scheduling: one thread runs an event loop, and each coroutine pauses at `await`, letting others run. Two 0.3s async sleeps finish in ~0.3s total — matching threading's I/O speedup with no OS threads, and it scales to far more concurrent waits.",
      section: 18
    }
  ]
};
