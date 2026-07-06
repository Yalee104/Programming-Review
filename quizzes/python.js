// Python quiz — questions map 1:1 to sections of python_study_summary.md
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
      q: "Which operator checks whether two names refer to the **same object in memory** (identity, not value)?",
      accept: ["is"],
      answerDisplay: "`is`",
      explain: "`is` compares identity (same object), `==` compares values. Use `==` for value comparisons and reserve `is` for identity checks like `x is None` — small-int caching makes `is` look like it works for numbers, but that is an implementation detail.",
      section: 2
    },

    // ---- Section 3
    {
      type: "mc",
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
      type: "fill",
      q: "`**kwargs` collects extra keyword arguments into what built-in type? (one word)",
      accept: ["dict", "a dict", "dictionary", "a dictionary"],
      answerDisplay: "a `dict`",
      explain: "`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict. The same `*`/`**` syntax at a call site does the reverse — it unpacks.",
      section: 3
    },

    // ---- Section 4
    {
      type: "mc",
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

    // ---- Section 5
    {
      type: "mc",
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
      type: "mc",
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

    // ---- Section 6
    {
      type: "mc",
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
      q: "Which exception does `next()` raise when a generator (or any iterator) has no more values?",
      accept: ["stopiteration", "StopIteration"],
      answerDisplay: "`StopIteration`",
      explain: "`StopIteration` is how the iterator protocol signals \"the loop ends\". A `for` loop calls `next()` for you and stops cleanly when it catches this exception — you never see it inside a for loop.",
      section: 6
    },

    // ---- Section 7
    {
      type: "mc",
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
      type: "fill",
      q: "Which keyword lets a nested function **assign** to a variable in its enclosing function's scope (not module scope)?",
      accept: ["nonlocal"],
      answerDisplay: "`nonlocal`",
      explain: "Without `nonlocal`, assigning to a name makes it local for the whole function body, so `count += 1` raises UnboundLocalError. `nonlocal` targets the nearest enclosing function scope; `global` skips straight to module scope.",
      section: 7
    },

    // ---- Section 8
    {
      type: "mc",
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

    // ---- Section 9
    {
      type: "mc",
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

    // ---- Section 11
    {
      type: "mc",
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

    // ---- Section 13
    {
      type: "mc",
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
      type: "mc",
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

    // ---- Section 15
    {
      type: "fill",
      q: "Which `functools` decorator memoizes a function so repeated calls with the same arguments return a cached result?",
      accept: ["lru_cache", "functools.lru_cache", "@lru_cache", "@functools.lru_cache", "cache", "functools.cache"],
      answerDisplay: "`functools.lru_cache` (or `functools.cache`)",
      explain: "`@functools.lru_cache(maxsize=None)` remembers each unique set of arguments. It turns naive recursive fib(30) from ~2.7 million calls into just 31 — exponential to linear.",
      section: 15
    },
    {
      type: "mc",
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

    // ---- Section 16
    {
      type: "mc",
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
      type: "mc",
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
      type: "fill",
      q: "Write the slice expression that returns list `a` reversed.",
      accept: ["a[::-1]", "[::-1]", "a[:: -1]", "a[::- 1]"],
      answerDisplay: "`a[::-1]`",
      explain: "A step of -1 walks backward through the whole sequence. It works on any sequence type and returns the same type (list in, list out; str in, str out).",
      section: 16
    },

    // ---- Section 17
    {
      type: "mc",
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

    // ---- Section 18
    {
      type: "mc",
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
