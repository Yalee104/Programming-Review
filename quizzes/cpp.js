// C++ quiz — questions map to sections of cpp_study_summary.md
// level: "beginner" | "intermediate" | "advanced"
window.QUIZZES = window.QUIZZES || {};
window.QUIZZES.cpp = {
  title: "C++ Quiz",
  sections: {
    1: "Implicit vs Explicit Conversion",
    2: "Qualifiers After Function Signature",
    3: "Struct vs Class",
    4: "Access Modifiers",
    5: "lvalue vs rvalue",
    6: "auto&& Universal Reference",
    7: "std::move",
    8: "Rule of 0, 3, 5",
    9: "Initializer List vs Body Assignment",
    10: "Move Constructor vs Move Assignment",
    11: "STL vs Standard Library",
    12: "STL Containers",
    13: "Templates",
    14: "Structured Bindings",
    15: "std::accumulate",
    16: "Inheritance",
    17: "Virtual Destructor",
    18: "Explicit Destructor vs Compiler Generated",
    19: "Virtual Destructor Inheritance Chain",
    20: "Smart Pointers — unique_ptr, shared_ptr, weak_ptr",
    21: "Mixing Raw Resources and STL Containers in a Class",
    22: "const — Types, Pointers, References, Classes, Typedef, auto",
    23: "const Pointee via typedef, const auto / auto& Clarified",
    24: "Operator Overloading",
    25: "Operator Fundamentals: Arity & Chaining",
    26: "Polymorphism & vtables",
    27: "std::optional & std::variant",
    28: "std::visit & the overloaded Pattern",
    29: "std::expected<T, E> (C++23)",
    30: "Callables + std::thread + Synchronization",
    31: "Exception Handling — try/catch, Unwinding, RAII & noexcept",
    32: "Lambda Captures In Depth",
    33: "std::string_view",
    34: "enum class vs Plain enum",
    35: "The Four C++ Casts",
    36: "constexpr & consteval",
    37: "C++20 Concepts & Ranges"
  },
  questions: [
    // ---- Section 1
    {
      type: "mc",
      level: "beginner",
      q: "What does marking a single-argument constructor `explicit` do?",
      code: "class Widget {\npublic:\n    explicit Widget(int id) {}\n};\nvoid process(Widget w) {}\n\nprocess(42);",
      choices: [
        "It blocks the implicit `int → Widget` conversion, so `process(42)` fails to compile",
        "It allows `process(42)` to silently construct a Widget",
        "It makes the constructor run at compile time",
        "It has no effect on this call"
      ],
      answer: 0,
      explain: "`explicit` prevents the compiler from doing implicit conversions through the constructor. `process(42)` is rejected; you must write `process(Widget(42))` to convert manually.",
      section: 1
    },
    {
      type: "mc",
      level: "intermediate",
      q: "WITHOUT `explicit`, why does `process(42)` compile at all?",
      code: "class Widget {\npublic:\n    Widget(int id) {}     // not explicit\n};\nvoid process(Widget w) {}\n\nprocess(42);   // compiles — why?",
      choices: [
        "The compiler silently calls `Widget(42)` for you — an implicit conversion through the constructor",
        "int and Widget are compatible types",
        "`process` accepts any type via templates",
        "It doesn't compile — an int can never become a Widget"
      ],
      answer: 0,
      explain: "A non-explicit single-argument constructor doubles as an implicit conversion: the compiler auto-converts `42` by constructing `Widget(42)`. Handy sometimes, but surprising conversions are why the guideline says mark single-arg constructors `explicit`.",
      section: 1
    },
    // ---- Section 2
    {
      type: "mc",
      level: "intermediate",
      q: "Which ordering of qualifiers is correct for an overriding const method?",
      choices: [
        "`void f() const override {}`",
        "`void f() override const {}`",
        "Either order compiles",
        "`void f() const = override {}`"
      ],
      answer: 0,
      explain: "The order is fixed: `const` must come before `override`. `void f() override const {}` is a compile error.",
      section: 2
    },
    {
      type: "fill",
      level: "beginner",
      q: "In `virtual void describe() const override = 0;`, which two characters at the end make the method **pure virtual** (subclass must implement)?",
      accept: ["= 0", "=0", "0"],
      answerDisplay: "`= 0`",
      explain: "`= 0` marks the function pure virtual — the class becomes abstract and every concrete subclass must provide an implementation.",
      section: 2
    },
    // ---- Section 3
    {
      type: "mc",
      level: "beginner",
      q: "What is the only real difference between `struct` and `class` in C++?",
      choices: [
        "Default access: `struct` members are public by default, `class` members are private",
        "`struct` cannot have methods or constructors",
        "`class` cannot be inherited from",
        "`struct` cannot have virtual functions"
      ],
      answer: 0,
      explain: "They are identical except for default access (and default inheritance access). `struct` defaults to public, `class` defaults to private — everything else (constructors, methods, inheritance, virtual) is the same.",
      section: 3
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why does `Multiplier times3{3};` work with no constructor defined?",
      code: "struct Multiplier {\n    int factor;\n    int operator()(int v) const { return v * factor; }\n};\nMultiplier times3{3};",
      choices: [
        "Multiplier is an aggregate, so `{3}` initializes its members directly (factor = 3) — no constructor needed",
        "The compiler generates a constructor taking one int",
        "operator() acts as the constructor",
        "It doesn't compile without a constructor"
      ],
      answer: 0,
      explain: "An aggregate (no user-declared/inherited ctors, no private/protected data members, no virtual functions/bases) can be brace-initialized member by member. A method like operator() does NOT disqualify it — only data members and constructors matter. Verified: times3(7) == 21.",
      example: "struct Point { int x; int y; };\nPoint p{3, 4};          // x=3, y=4  (members in order)\nPoint zero{};           // 0, 0      (all value-initialized)\nPoint d{.y = 8};        // 0, 8      (C++20 designated init)",
      section: 3
    },
    {
      type: "mc",
      level: "advanced",
      q: "What is `p` after `struct Point { int x; int y; }; Point p{7};`?",
      choices: [
        "`p.x == 7, p.y == 0` — supplying fewer initializers value-initializes the rest (zeroes them)",
        "`p.x == 7, p.y == 7` — the value is copied to all members",
        "A compile error — you must initialize every member",
        "`p.x == 7, p.y` is uninitialized garbage"
      ],
      answer: 0,
      explain: "Aggregate init fills members in order; omitted ones are value-initialized (zeroed), so p.y is a well-defined 0 (verified). `Point{}` zeroes everything; C++20 designated initializers (`Point{.y = 8}`) name members explicitly. Note: adding a user-declared constructor or a private data member would make brace init call a constructor instead (or fail).",
      section: 3
    },
    // ---- Section 4
    {
      type: "mc",
      level: "advanced",
      q: "Is the following legal, given `balance_` is a `private` member of `Account`?",
      code: "bool hasMoreThan(const Account& other) const {\n    return balance_ > other.balance_;   // read OTHER object's private\n}",
      choices: [
        "Yes — `private` is per-CLASS, so any Account can access another Account's private members",
        "No — `private` means only `this` object can access its own members",
        "Only if `other` is passed by value",
        "Only if `hasMoreThan` is a `friend`"
      ],
      answer: 0,
      explain: "`private` is per-class, not per-object. Code belonging to the Account class can read/write the private members of ANY Account instance — not just `this`. From outside the class, private is still fully blocked.",
      section: 4
    },
    // ---- Section 5
    {
      type: "mc",
      level: "beginner",
      q: "In `int x = 5;`, which part is the **rvalue**?",
      choices: [
        "`5` — a temporary with no name and no address (`&5` is illegal)",
        "`x` — it holds the value",
        "`int` — the type",
        "The whole statement"
      ],
      answer: 0,
      explain: "An rvalue is a temporary: no name, no address, doesn't persist. `x` is an lvalue — it has a name and `&x` works. This split is the foundation for rvalue references (`int&&`) and move semantics.",
      section: 5
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which statement is a compile error?",
      code: "int x = 5;\nint&  a = x;   // A\nint&& b = 5;   // B\nint&  c = 5;   // C",
      choices: [
        "C — a non-const lvalue reference cannot bind to an rvalue (`5`)",
        "A — lvalue references are illegal",
        "B — rvalue references cannot bind literals",
        "None; all three compile"
      ],
      answer: 0,
      explain: "`5` is an rvalue (temporary, no address). A non-const lvalue reference `int&` can only bind an lvalue, so `int& c = 5;` fails. An rvalue reference `int&& b = 5;` binds it fine.",
      section: 5
    },
    {
      type: "fill",
      level: "beginner",
      q: "What kind of value has a name and an address that persists — the opposite of an rvalue? (one word)",
      accept: ["lvalue", "an lvalue"],
      answerDisplay: "an `lvalue`",
      explain: "An lvalue has a name and an address you can take with `&`. An rvalue is a temporary with no name and no address (`&5` is illegal).",
      section: 5
    },
    // ---- Section 6
    {
      type: "mc",
      level: "intermediate",
      q: "In a range-based for loop, why is `auto&&` often the safest choice?",
      code: "for (auto&& item : collection) { }",
      choices: [
        "It's a universal reference — it binds to both lvalues and rvalues, handling all cases",
        "It always makes a copy of each element, which is safest",
        "It converts every element to const",
        "It's required syntax for range-for loops"
      ],
      answer: 0,
      explain: "`auto&&` is a universal (forwarding) reference: it deduces to `T&` for lvalues and `T&&` for rvalues, so it binds to anything a container yields — including proxy/temporary elements — without an unwanted copy.",
      section: 6
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What do these two declarations deduce to?",
      code: "int x = 1;\nauto&& a = x;    // ?\nauto&& b = 5;    // ?",
      choices: [
        "`a` becomes `int&` (lvalue source), `b` becomes `int&&` (rvalue source)",
        "Both become `int&&`",
        "Both become `int&`",
        "`a` is `int`, `b` is a compile error"
      ],
      answer: 0,
      explain: "`auto&&` adapts to what it binds: an lvalue collapses it to `int&`, an rvalue makes it `int&&` (with lifetime extension for temporaries). Note the same `&&` on a CONCRETE type (`Widget&&`) is a plain rvalue reference — only `auto&&`/`T&&` are universal.",
      section: 6
    },
    // ---- Section 7
    {
      type: "mc",
      level: "intermediate",
      q: "What does `std::move(x)` actually do?",
      choices: [
        "Nothing but cast `x` to an rvalue reference — the real moving is done by a move constructor/assignment",
        "Immediately transfers `x`'s resources to a new object",
        "Frees the memory held by `x`",
        "Makes a deep copy of `x`"
      ],
      answer: 0,
      explain: "`std::move` moves nothing — it's just `static_cast<T&&>(x)`, stripping the name so the value binds to move operations. The actual stealing happens in the move constructor/assignment (e.g. `vector`'s), which is why `a.size()` is 0 after `vector b = std::move(a)`.",
      section: 7
    },
    {
      type: "mc",
      level: "beginner",
      q: "What does `a.size()` print after this?",
      code: "std::vector<int> a = {1, 2, 3};\nstd::vector<int> b = std::move(a);\nstd::cout << a.size();",
      choices: [
        "`0` — vector's move constructor stole a's contents, leaving it empty",
        "`3` — moving copies the data",
        "Undefined — reading a moved-from vector crashes",
        "It doesn't compile"
      ],
      answer: 0,
      explain: "The move constructor steals `a`'s internal buffer into `b`, leaving `a` in a valid but empty state — verified `a.size() == 0`. That's the whole point of moving: transfer instead of the deep copy a plain `b = a` would do.",
      section: 7
    },
    // ---- Section 8
    {
      type: "mc",
      level: "beginner",
      q: "What are the FIVE special member functions in the Rule of 5?",
      choices: [
        "Destructor, copy ctor, copy assignment, move ctor, move assignment",
        "Constructor, destructor, copy ctor, operator==, operator=",
        "Default ctor, copy ctor, move ctor, destructor, swap",
        "Constructor, destructor, new, delete, operator="
      ],
      answer: 0,
      explain: "The five are: destructor, copy constructor, copy assignment, move constructor, move assignment. Rule of 0 = own no raw resources and define none (preferred); Rule of 3 = destructor + copy ctor + copy assign; Rule of 5 adds the two move operations.",
      section: 8
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which 'Rule of N' is the modern recommended default — own no raw resources and let the compiler generate everything? (a number)",
      accept: ["0", "rule of 0", "zero", "rule of zero"],
      answerDisplay: "Rule of 0",
      explain: "Rule of 0: hold resources in types that manage themselves (e.g. `std::unique_ptr`, `std::vector`) so you write none of the five special members. The compiler handles everything correctly.",
      section: 8
    },
    // ---- Section 9
    {
      type: "mc",
      level: "intermediate",
      q: "Which members MUST be initialized in a constructor's initializer list (cannot be assigned in the body)?",
      code: "const int id_;   // ?\nint& ref_;       // ?\nBar member_;     // Bar has no default ctor",
      choices: [
        "const members, references, and members whose type has no default constructor",
        "Only pointer members",
        "Only members of built-in types like int",
        "None — anything can be assigned in the body"
      ],
      answer: 0,
      explain: "const members and references must be initialized (they can't be default-initialized then reassigned), and a member with no default constructor has nothing to default-init to. All three require the initializer list. Body assignment would default-init first, then overwrite — impossible for these.",
      section: 9
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What is the real difference between these two constructors?",
      code: "Buffer(int size) : data_(new int[size]), size_(size) {}   // A\nBuffer(int size) { data_ = new int[size]; size_ = size; }  // B",
      choices: [
        "A initializes the members directly; B default-initializes first THEN overwrites — two steps",
        "They compile to identical code",
        "B is faster because assignment is cheaper",
        "A only works for pointers"
      ],
      answer: 0,
      explain: "The initializer list (A) constructs each member directly with its value. Body assignment (B) first default-initializes every member, then assigns over it — wasted work for class-type members, and impossible for const members, references, and types without default constructors.",
      section: 9
    },
    // ---- Section 10
    {
      type: "mc",
      level: "intermediate",
      q: "What distinguishes the move constructor from move assignment?",
      code: "Widget b = std::move(a);   // (1)\nWidget c(99);\nc = std::move(a);          // (2)",
      choices: [
        "(1) constructs a brand-new object; (2) reuses an object that already exists",
        "(1) copies, (2) moves",
        "They are identical",
        "(1) is for lvalues, (2) is for rvalues"
      ],
      answer: 0,
      explain: "The move constructor builds a NEW object from an rvalue. Move assignment targets an ALREADY-existing object (so it must also release whatever it currently holds first). Mark both `noexcept` so STL containers use move instead of copy.",
      section: 10
    },
    {
      type: "fill",
      level: "advanced",
      q: "Which specifier must a move constructor have for STL containers (like vector on reallocation) to prefer moving over copying?",
      accept: ["noexcept"],
      answerDisplay: "`noexcept`",
      explain: "Containers only use your move constructor during reallocation if it's `noexcept` — otherwise they fall back to copying to preserve the strong exception guarantee.",
      section: 10
    },
    // ---- Section 11
    {
      type: "mc",
      level: "beginner",
      q: "Which components are part of the original STL (now within the C++ Standard Library)?",
      choices: [
        "Containers, algorithms, and iterators",
        "iostream, string, and filesystem",
        "thread, mutex, and chrono",
        "unique_ptr and shared_ptr"
      ],
      answer: 0,
      explain: "The STL proper is containers (vector, map…), algorithms (sort, accumulate…), and iterators. I/O, std::string, smart pointers, threading, etc. are standard-library components that were not part of the original STL — though 'STL' is used loosely to mean the whole standard library.",
      section: 11
    },
    // ---- Section 12
    {
      type: "mc",
      level: "beginner",
      q: "Which container gives average O(1) key lookup using a hash?",
      choices: [
        "`std::unordered_map`",
        "`std::map`",
        "`std::vector`",
        "`std::set`"
      ],
      answer: 0,
      explain: "`std::unordered_map` uses hashing for average O(1) lookup. `std::map` is a sorted tree with O(log n) lookup. `std::set` stores unique sorted values; `std::vector` is a dynamic array.",
      section: 12
    },
    {
      type: "mc",
      level: "beginner",
      q: "Which container is LIFO — the last element pushed is the first popped?",
      choices: [
        "`std::stack`",
        "`std::queue`",
        "`std::deque`",
        "`std::priority_queue`"
      ],
      answer: 0,
      explain: "`std::stack` is LIFO; `std::queue` is FIFO; `std::priority_queue` always has the largest element on top; `std::deque` is a general container with fast insert at both ends.",
      section: 12
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which STL container is the default go-to dynamic array?",
      accept: ["std::vector", "vector"],
      answerDisplay: "`std::vector`",
      explain: "`std::vector<T>` is the default choice — a contiguous dynamic array with O(1) indexing and amortized O(1) push_back.",
      section: 12
    },
    // ---- Section 13
    {
      type: "mc",
      level: "beginner",
      q: "For `template <typename T> T max_of(T a, T b)`, what does `max_of(3, 5)` do?",
      choices: [
        "Deduces `T = int` implicitly from the arguments",
        "Fails — you must always write `max_of<int>(3, 5)`",
        "Deduces `T = double`",
        "Returns a reference to the larger argument"
      ],
      answer: 0,
      explain: "Template type parameters are deduced implicitly from the call arguments, so `max_of(3, 5)` gives `T = int`. You can also specify explicitly: `max_of<double>(3, 5)`.",
      section: 13
    },
    {
      type: "mc",
      level: "advanced",
      q: "With the SINGLE-parameter template below, what does `max_of(3, 5.0)` do?",
      code: "template <typename T>\nT max_of(T a, T b) { return a > b ? a : b; }\n\nmax_of(3, 5.0);   // int and double",
      choices: [
        "Compile error — T deduces to int from `3` but double from `5.0`, and the deductions conflict",
        "T becomes double; the int is promoted automatically",
        "T becomes int; the double is truncated",
        "It works and returns 5.0"
      ],
      answer: 0,
      explain: "Each argument must deduce the SAME T, and int vs double conflict — deduction fails. Fixes: call `max_of<double>(3, 5.0)` explicitly, or use two type parameters (`template <typename T, typename U> auto max_of(T a, U b)`), which the summary shows for exactly this case.",
      section: 13
    },
    // ---- Section 14
    {
      type: "mc",
      level: "intermediate",
      q: "What does the `&` do here, and what happens if you write to `a`, `b`, or `c`?",
      code: "struct P { int x, y, z; };\nP p{1, 2, 3};\nauto& [a, b, c] = p;",
      choices: [
        "Binds by reference — writing to a/b/c modifies the original `p`",
        "Binds by copy — writes don't affect `p`",
        "It's a syntax error; you can't reference-bind a structured binding",
        "Makes a/b/c const"
      ],
      answer: 0,
      explain: "`auto& [a, b, c]` binds the structured bindings by reference to `p`'s members, so assigning to `a` changes `p.x`. Plain `auto [a,b,c]` copies. The count must match the number of members exactly.",
      section: 14
    },
    {
      type: "mc",
      level: "beginner",
      q: "What is the most common everyday use of structured bindings?",
      code: "for (const auto& [key, value] : mymap) { }",
      choices: [
        "Unpacking key/value pairs while iterating a map",
        "Declaring template parameters",
        "Overloading operators",
        "Catching exceptions"
      ],
      answer: 0,
      explain: "Iterating an associative container yields `pair<const Key, Value>`; `const auto& [key, value]` unpacks each pair cleanly instead of using `.first`/`.second`.",
      example: "std::map<std::string, int> m{{\"a\", 1}, {\"b\", 2}};\nfor (const auto& [key, value] : m)\n    std::cout << key << \"=\" << value << \" \";\n// a=1 b=2",
      section: 14
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `auto [a, b] = P{1, 2, 3};` do, where P has three members?",
      choices: [
        "Compile error — the binding count must match the member count exactly",
        "Binds the first two members and ignores the third",
        "Binds a=1 and b={2,3}",
        "Runtime error"
      ],
      answer: 0,
      explain: "Structured bindings must name EVERY member: `auto [a, b, c]` works, `auto [a, b]` is a compile error. For members you don't need, bind them anyway and use `_` by convention: `auto [a, _, c]`.",
      section: 14
    },
    // ---- Section 15
    {
      type: "mc",
      level: "intermediate",
      q: "What determines the return type of `std::accumulate(v.begin(), v.end(), init)`?",
      choices: [
        "The type of the `init` argument",
        "The element type of the container",
        "Always `int`",
        "The iterator category"
      ],
      answer: 0,
      explain: "The accumulator (and return) type is the type of `init`. `accumulate(b, e, 0)` returns int; `accumulate(b, e, 0.0)` returns double — a classic bug source when summing doubles with an int seed.",
      example: "std::vector<int> v{1, 2, 3, 4};\nstd::accumulate(v.begin(), v.end(), 0);     // 10   (int)\nstd::accumulate(v.begin(), v.end(), 0.0);   // 10.0 (double!)",
      section: 15
    },
    {
      type: "mc",
      level: "intermediate",
      q: "`v` is a `std::vector<double>`. What's the subtle bug in `std::accumulate(v.begin(), v.end(), 0)`?",
      choices: [
        "The int `0` makes the accumulator an int — every partial sum gets truncated",
        "accumulate doesn't work on doubles",
        "It throws at runtime",
        "Nothing — the result is a double"
      ],
      answer: 0,
      explain: "The init argument's type IS the accumulator type. With `0` (int), each addition truncates back to int, silently losing the fractional parts. Write `0.0` to accumulate (and return) a double.",
      section: 15
    },
    // ---- Section 16
    {
      type: "mc",
      level: "beginner",
      q: "What does `class Derived : public Base` express?",
      choices: [
        "An is-a relationship — Base's full public interface stays public on Derived",
        "A has-a relationship — Derived contains a Base member",
        "Base's members all become private in Derived",
        "Derived can only use Base's static members"
      ],
      answer: 0,
      explain: "public inheritance is the is-a relationship: Base's public members stay public, protected stay protected. protected/private inheritance instead hide the interface from outside (and, for private, from grandchildren too).",
      section: 16
    },
    {
      type: "mc",
      level: "advanced",
      q: "What problem does `virtual` inheritance solve?",
      code: "class Bird : virtual public Animal {};\nclass Fish : virtual public Animal {};\nclass Platypus : public Bird, public Fish {};",
      choices: [
        "The diamond problem — ensures Platypus has ONE shared Animal subobject, not two",
        "It makes all methods virtual automatically",
        "It speeds up member access",
        "It prevents Platypus from being instantiated"
      ],
      answer: 0,
      explain: "Without `virtual` inheritance, Platypus would contain two separate Animal subobjects (one via Bird, one via Fish). `virtual public Animal` makes them share a single Animal — the fix for the diamond problem.",
      section: 16
    },
    {
      type: "mc",
      level: "intermediate",
      q: "With `class Derived : private Base`, what happens to Base's public members?",
      choices: [
        "They become private in Derived — hidden from outside AND from Derived's own subclasses",
        "They stay public",
        "They become protected",
        "They are removed entirely"
      ],
      answer: 0,
      explain: "private inheritance makes inherited public and protected members private in Derived, hiding them from both outside code and further-derived classes. protected inheritance would make them protected (hidden from outside, still available to grandchildren).",
      section: 16
    },
    // ---- Section 17
    {
      type: "mc",
      level: "intermediate",
      q: "Why does deleting through a base pointer leak without a virtual destructor?",
      code: "class Animal { public: ~Animal() {} };        // NOT virtual\nclass Dog : public Animal { std::string name_; };\nAnimal* a = new Dog();\ndelete a;",
      choices: [
        "Only `~Animal()` runs — `~Dog()` is skipped, so Dog's members never get cleaned up",
        "Both destructors run in the wrong order",
        "It's a compile error",
        "`delete a` does nothing at all"
      ],
      answer: 0,
      explain: "Without a virtual destructor, `delete a` uses the pointer's static type (Animal) and calls only `~Animal()`. `~Dog()` never runs, leaking `name_`. Making the base destructor `virtual` fixes it — `~Dog()` then `~Animal()` run correctly.",
      section: 17
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Roughly what happens to `sizeof` an object when its class gains its first virtual function?",
      code: "class Foo { int x; };                    // sizeof = 4\nclass Bar { int x; virtual ~Bar(){}; };  // sizeof = ?",
      choices: [
        "It grows (e.g. 4 → 16) because a vtable pointer is added to each object",
        "It stays the same",
        "It shrinks",
        "It doubles the size of every member"
      ],
      answer: 0,
      explain: "The first virtual function gives the class a vtable and every object a hidden vptr (8 bytes on 64-bit), so `sizeof` jumps — here 4 → 16 after alignment/padding.",
      section: 17
    },
    {
      type: "mc",
      level: "beginner",
      q: "When is a virtual destructor **not** needed?",
      choices: [
        "When the class is never used as a base class or through a base pointer/reference",
        "Never — every class must have one",
        "When the class has data members",
        "When the class is small"
      ],
      answer: 0,
      explain: "A virtual destructor matters only for polymorphic deletion (deleting a derived object through a base pointer). A class never used as a base, or whose exact type is always known, doesn't need one — and skipping it avoids the vptr size cost.",
      section: 17
    },
    // ---- Section 18
    {
      type: "mc",
      level: "beginner",
      q: "When should you declare an explicit destructor?",
      choices: [
        "Only when the class directly owns a raw resource (e.g. a `new[]` pointer)",
        "Always, for every class",
        "Only for classes with no members",
        "Never — destructors are obsolete"
      ],
      answer: 0,
      explain: "Declare a destructor only if you own a raw resource needing manual cleanup (e.g. `delete[] points_`). Members like `double` or `std::string` clean themselves up, so no destructor is needed (Rule of 0).",
      section: 18
    },
    // ---- Section 19
    {
      type: "mc",
      level: "intermediate",
      q: "How far down an inheritance chain do you need to repeat `virtual` on the destructor?",
      code: "class Shape { public: virtual ~Shape() = default; };\nclass Circle : public Shape { public: ~Circle() override {} };\nclass FilledCircle : public Circle { public: ~FilledCircle() override {} };",
      choices: [
        "Only once, on the base — virtual propagates down automatically to all derived destructors",
        "On every class in the chain, or dispatch breaks",
        "Only on the most-derived class",
        "Never — destructors can't be virtual"
      ],
      answer: 0,
      explain: "Declaring the base destructor `virtual` once makes every derived destructor implicitly virtual. `override` on the derived ones is optional but recommended for clarity. Deleting a `Shape*` to a FilledCircle runs ~FilledCircle → ~Circle → ~Shape.",
      section: 19
    },
    {
      type: "mc",
      level: "advanced",
      q: "In what ORDER do the destructors run here?",
      code: "Shape* s = new FilledCircle();   // FilledCircle : Circle : Shape\ndelete s;                        // Shape's dtor is virtual",
      choices: [
        "`~FilledCircle()` → `~Circle()` → `~Shape()` — most-derived first, bottom-up",
        "`~Shape()` → `~Circle()` → `~FilledCircle()` — base first",
        "Only `~FilledCircle()` runs",
        "The order is unspecified"
      ],
      answer: 0,
      explain: "Destruction runs bottom-up: the most-derived destructor first, then each base in reverse construction order. (Construction is the mirror image: Shape → Circle → FilledCircle.) The virtual base destructor is what makes the chain start at the REAL type.",
      section: 19
    },
    // ---- Section 20
    {
      type: "mc",
      level: "beginner",
      q: "What happens to `p1` after `std::unique_ptr<Dog> p2 = std::move(p1);`?",
      choices: [
        "`p1` becomes null — ownership is transferred, not duplicated",
        "`p1` and `p2` both own the Dog",
        "It's a compile error",
        "`p1` still owns the Dog; `p2` is null"
      ],
      answer: 0,
      explain: "`unique_ptr` is move-only. Moving transfers sole ownership: `p1 == nullptr` afterward, `p2` is the owner. Copying (`unique_ptr b = p2;`) is a compile error — the copy constructor is deleted.",
      example: "auto p1 = std::make_unique<int>(42);\nauto p2 = std::move(p1);    // ownership transferred\n// p1 == nullptr (true),  *p2 == 42\n// auto p3 = p2;   // ERROR: unique_ptr is not copyable",
      section: 20
    },
    {
      type: "mc",
      level: "beginner",
      q: "With several `shared_ptr`s owning the same object, when is the object destroyed?",
      choices: [
        "When the LAST owner goes away — the reference count reaches zero",
        "When the FIRST owner goes away",
        "Never — shared objects leak by design",
        "When you call delete on any of them"
      ],
      answer: 0,
      explain: "shared_ptr copies share ownership via an atomic reference count: copy = refcount++, destruction = refcount--. Verified: with use_count 2, one owner leaving keeps the object alive; it's destroyed only when the count hits 0.",
      section: 20
    },
    {
      type: "mc",
      level: "advanced",
      q: "Why use `std::weak_ptr` for a 'back' reference between two objects?",
      choices: [
        "It doesn't affect the reference count, so it breaks the shared_ptr↔shared_ptr cycle that would leak",
        "It's faster to dereference than shared_ptr",
        "It automatically deletes the other object",
        "It converts shared ownership to exclusive ownership"
      ],
      answer: 0,
      explain: "Two objects holding `shared_ptr`s to each other never reach refcount 0 — a leak. Making one direction a `weak_ptr` (non-owning) breaks the cycle. You call `.lock()` to get a temporary shared_ptr (empty if the object is already gone).",
      section: 20
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `w.lock()` return on a `std::weak_ptr` whose object has already been destroyed?",
      choices: [
        "An empty/null `shared_ptr` — no crash, you just check it before use",
        "A dangling pointer to freed memory",
        "It throws an exception",
        "It resurrects the object"
      ],
      answer: 0,
      explain: "`.lock()` is what makes weak_ptr safe: it atomically produces a temporary owning shared_ptr, or an EMPTY one if the object is gone (`w.expired()` true). The `if (auto locked = w.lock()) { ... }` pattern guards all access.",
      example: "auto s = std::make_shared<int>(7);\nstd::weak_ptr<int> w = s;   // does NOT bump use_count\nif (auto locked = w.lock()) {\n    // safe: locked is a shared_ptr, *locked == 7\n}   // w.lock() gives an empty shared_ptr if the object is gone",
      section: 20
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which factory function should you prefer over `new` to create a `unique_ptr<T>`?",
      accept: ["std::make_unique", "make_unique", "std::make_unique<T>", "make_unique<T>"],
      answerDisplay: "`std::make_unique`",
      explain: "`std::make_unique<T>(args...)` is exception-safe and less error-prone than raw `new`. (`std::make_shared` is the shared_ptr equivalent, and also allocates the control block in the same allocation as the object.)",
      example: "auto p   = std::make_unique<int>(42);   // preferred over new\nauto arr = std::make_unique<int[]>(3);  // array form -> delete[]\n// std::make_shared<T>(...) is the shared_ptr equivalent",
      section: 20
    },
    // ---- Section 21
    {
      type: "mc",
      level: "advanced",
      q: "You write a custom copy constructor for a class that has both a raw pointer AND a `std::vector` member. What must you handle?",
      choices: [
        "Every member yourself — including the vector — because writing one copy op stops the compiler auto-generating it",
        "Only the raw pointer; the vector copies itself",
        "Nothing; the compiler still fills in the members",
        "Only the vector; raw pointers copy safely"
      ],
      answer: 0,
      explain: "Once you write any custom copy/move constructor or assignment, the compiler stops generating that function. You become responsible for EVERY member — deep-copying the raw resource AND explicitly copying the STL members (they won't be handled for you).",
      section: 21
    },
    // ---- Section 22
    {
      type: "mc",
      level: "intermediate",
      q: "What does `const int* p` mean (read right-to-left)?",
      code: "const int* p1;   // ?\nint* const p2;   // ?",
      choices: [
        "`p1` is a pointer to a const int — the data is locked, the pointer can be repointed",
        "`p1` is a const pointer to int — the pointer is locked, the data is mutable",
        "Both the pointer and the data are const",
        "Neither is const"
      ],
      answer: 0,
      explain: "`const int* p1` = pointer to const int (low-level const): you can't write `*p1`, but you can repoint `p1`. `int* const p2` = const pointer to int (top-level const): you can write `*p2` but can't repoint. const on the LEFT of `*` locks the data; on the RIGHT locks the pointer.",
      section: 22
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `auto` do to top-level const when deducing a type?",
      code: "const int ci = 100;\nauto a1 = ci;   // type of a1?",
      choices: [
        "Strips it — `a1` is a plain `int` copy you can modify",
        "Keeps it — `a1` is `const int`",
        "Makes `a1` a `const int&`",
        "Fails to compile"
      ],
      answer: 0,
      explain: "`auto` copies and strips top-level const/reference, so `a1` is a mutable `int`. To keep const you write `const auto a2 = ci;`. Note `auto&` does NOT strip const — it mirrors the source's constness.",
      section: 22
    },
    {
      type: "fill",
      level: "intermediate",
      q: "Which keyword lets a data member be modified even inside a `const` member function?",
      accept: ["mutable"],
      answerDisplay: "`mutable`",
      explain: "A `mutable` member (e.g. a cache counter) can be changed even through a const method or on a const object — the escape hatch for logically-const-but-physically-changing state.",
      section: 22
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which keyword, placed AFTER a member function's signature, promises the method won't modify the object's members?",
      accept: ["const"],
      answerDisplay: "`const`",
      explain: "`int getValue() const { ... }` is a const member function — it can't modify non-mutable members, and it's the ONLY kind of method callable on a const object (`const Widget cw; cw.getValue()` OK, `cw.setValue(10)` error).",
      section: 22
    },
    {
      type: "mc",
      level: "advanced",
      q: "Why is `const auto&` called the 'universal safe read-only binding'?",
      code: "const auto& a4 = x;",
      choices: [
        "It binds to lvalues, rvalues (extending their lifetime), and const sources alike — always read-only, never a copy",
        "It's the only binding that compiles for all types",
        "It makes the source variable const too",
        "It's a copy that can't be modified"
      ],
      answer: 0,
      explain: "A const reference can bind an lvalue, a temporary (rvalue — with lifetime extension), or a const source, and never allows modification through it. That's also why `const T&` is the standard way to pass read-only arguments cheaply.",
      section: 22
    },
    // ---- Section 23
    {
      type: "mc",
      level: "advanced",
      q: "Given `typedef char* PChar;`, what does `const PChar cstr` actually lock?",
      choices: [
        "The pointer itself (`char* const`) — the chars remain mutable",
        "The characters pointed to (`const char*`)",
        "Both the pointer and the characters",
        "Nothing — const is ignored on typedefs"
      ],
      answer: 0,
      explain: "const applies to the alias as a whole; it can't 'see through' the typedef to the pointee. So `const PChar` means `char* const` — a const pointer to mutable chars. To lock the pointee you must bake const into the alias: `typedef const char* PConstChar;`.",
      section: 23
    },
    {
      type: "mc",
      level: "advanced",
      q: "Why is `refB` read-only here, given the same `auto&` syntax makes `refA` writable?",
      code: "int x = 1;\nconst int y = 2;\nauto& refA = x;   // int&\nauto& refB = y;   // ?",
      choices: [
        "`auto&` preserves the source's const-ness — `y` is const, so `refB` is `const int&`",
        "`auto&` always produces a const reference",
        "It's a compile error to bind `refB`",
        "`refB` is actually writable; the summary is wrong"
      ],
      answer: 0,
      explain: "`auto&` never strips const — it mirrors whatever the source has. `x` is non-const → `refA` is `int&` (writable); `y` is const → `refB` is `const int&` (read-only). The `&` only says 'reference, don't copy'; it says nothing about const.",
      section: 23
    },
    // ---- Section 24
    {
      type: "mc",
      level: "intermediate",
      q: "Why must `operator<<` for stream output be a NON-member function?",
      code: "std::ostream& operator<<(std::ostream& os, const Vec2& v);",
      choices: [
        "The left operand is `std::ostream`, not your class — you can't add a member to ostream",
        "Member operators can't return references",
        "It must be virtual",
        "Members can't take two arguments"
      ],
      answer: 0,
      explain: "For `cout << v`, the left operand is the stream. Since you can't add a member function to `std::ostream`, `operator<<` must be a free (often friend) function taking `(ostream&, const Vec2&)`. Returning the stream makes chaining `cout << a << b` work.",
      section: 24
    },
    {
      type: "mc",
      level: "intermediate",
      q: "How does the compiler tell prefix `++c` from postfix `c++` in an overload?",
      choices: [
        "Postfix takes a dummy `int` parameter; prefix takes none",
        "Postfix is a member, prefix is non-member",
        "They must have different names",
        "Prefix returns void, postfix returns bool"
      ],
      answer: 0,
      explain: "`operator++()` is prefix (returns the new value by reference); `operator++(int)` — with an unused dummy int — is postfix (returns a copy of the OLD value). The dummy int is purely a disambiguation marker.",
      section: 24
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does the C++20 defaulted spaceship operator generate?",
      code: "auto operator<=>(const Score&) const = default;",
      choices: [
        "All six comparisons (<, <=, >, >=, ==, !=) from member-wise comparison",
        "Only `<` and `>`",
        "A hash function",
        "The copy constructor"
      ],
      answer: 0,
      explain: "`operator<=>` defaulted auto-derives the full set of relational comparisons (and `==`/`!=`) from member-wise comparison, replacing six hand-written operators with one line.",
      section: 24
    },
    {
      type: "fill",
      level: "beginner",
      q: "An object that overloads `operator()` so it can be 'called like a function' is commonly called a ______.",
      accept: ["functor", "function object", "a functor", "function-object"],
      answerDisplay: "functor (function object)",
      explain: "A class with `operator()` (like `Multiplier` where `times3(7)` gives 21) is a functor. Lambdas are compiler-generated functors.",
      section: 24
    },
    {
      type: "mc",
      level: "beginner",
      q: "Why does `operator+=` return `*this` by reference?",
      code: "Vec2& operator+=(const Vec2& other) {\n    x_ += other.x_; y_ += other.y_;\n    return *this;\n}",
      choices: [
        "So calls can be chained — the result is the modified object itself, ready for the next operation",
        "To avoid a compile error — operators must return references",
        "To make the operator virtual",
        "It returns a copy either way"
      ],
      answer: 0,
      explain: "Returning `*this` by reference means the expression evaluates to the (modified) object, enabling chaining like `(a += b) += c` — the same reason `operator<<` returns the stream so `cout << a << b` works.",
      section: 24
    },
    // ---- Section 25
    {
      type: "mc",
      level: "advanced",
      q: "Can you change the arity (number of operands) of `operator+`?",
      choices: [
        "No — binary operators always take 2 operands; member vs non-member only changes how many params you write explicitly",
        "Yes, by adding extra parameters",
        "Yes, but only in C++20",
        "Only for unary operators"
      ],
      answer: 0,
      explain: "Arity is fixed by the operator. `operator+` is always binary. As a member, `*this` fills the left operand so you write one explicit param; as a non-member you write both. Adding a third param (`operator+(const Vec2&, int)`) fails to compile.",
      section: 25
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which operator is the exception that CAN be overloaded with any number of parameters?",
      choices: [
        "`operator()` — the function-call operator has no fixed arity",
        "`operator+`",
        "`operator[]`",
        "`operator<<`"
      ],
      answer: 0,
      explain: "`operator()` is special: you can overload it with zero, one, or many parameters (like an `Adder` functor with 0–3 args). Every other operator has fixed arity.",
      section: 25
    },
    {
      type: "mc",
      level: "advanced",
      q: "What happens when you try to compile this member operator?",
      code: "class Vec2 {\n    Vec2 operator+(const Vec2& rhs, int extra) const { ... }\n};",
      choices: [
        "Compile error: a binary member operator+ 'must have either zero or one argument' — *this already fills the left slot",
        "It compiles; `extra` defaults to 0",
        "It compiles as a ternary operator",
        "Runtime error when called"
      ],
      answer: 0,
      explain: "A member binary operator gets its LEFT operand implicitly via *this, so exactly ONE explicit parameter is allowed. You cannot extend an operator's arity — verified error: 'operator+(const Vec2&, int) must have either zero or one argument'.",
      section: 25
    },
    // ---- Section 26
    {
      type: "mc",
      level: "intermediate",
      q: "A vtable exists once per ____, and a vptr exists once per ____.",
      choices: [
        "class ; object",
        "object ; class",
        "function ; class",
        "object ; function"
      ],
      answer: 0,
      explain: "There's one vtable per polymorphic CLASS (a static array of function pointers). Each OBJECT carries a hidden vptr pointing at its class's vtable. A virtual call reads the vptr, indexes the vtable, and jumps.",
      section: 26
    },
    {
      type: "mc",
      level: "advanced",
      q: "What does 'object slicing' do to polymorphism?",
      code: "Dog dog;\nAnimal sliced = dog;   // copy into a plain Animal\nsliced.speak();",
      choices: [
        "Destroys it — the copy gets Animal's vtable, so `speak()` calls Animal's version",
        "Preserves it — `speak()` still calls Dog's version",
        "Causes a runtime crash",
        "Makes `sliced` an abstract object"
      ],
      answer: 0,
      explain: "Copying a Dog into a by-value Animal slices off the Dog part; Animal's copy constructor sets the vptr to Animal's vtable. So `sliced.speak()` prints 'Animal speaks'. Polymorphism only works through pointers/references, where the vptr travels with the real object.",
      section: 26
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `dynamic_cast<Dog*>(a)` return when `a` actually points to a `Cat`?",
      choices: [
        "`nullptr` — the runtime RTTI check fails safely",
        "A dangling Dog pointer",
        "It throws `std::bad_cast`",
        "It succeeds and returns a valid pointer"
      ],
      answer: 0,
      explain: "For POINTERS, a failed `dynamic_cast` returns `nullptr` (check before use). For REFERENCES it throws `std::bad_cast` (no null references). It requires a polymorphic source type (≥1 virtual function), unlike `static_cast` which does no runtime check.",
      section: 26
    },
    {
      type: "mc",
      level: "advanced",
      q: "And what does the REFERENCE form `dynamic_cast<Dog&>(*a2)` do when `*a2` is really a Cat?",
      choices: [
        "Throws `std::bad_cast` — there's no such thing as a null reference to return",
        "Returns a null reference",
        "Returns a reference to a default-constructed Dog",
        "Compile error — dynamic_cast only works on pointers"
      ],
      answer: 0,
      explain: "The pointer form reports failure with nullptr; the reference form CAN'T (no null references), so it throws `std::bad_cast` instead. Verified: catching `const std::bad_cast&` prints \"std::bad_cast\". Also remember: the source type must be polymorphic.",
      section: 26
    },
    {
      type: "mc",
      level: "advanced",
      q: "`d1` and `d2` are two `Dog` objects; `c1` is a `Cat`. Comparing their hidden vptrs, what holds?",
      code: "Dog d1, d2;\nCat c1;\n// vptr_d1, vptr_d2, vptr_c1 read from the objects",
      choices: [
        "`vptr_d1 == vptr_d2` (same class → SAME vtable) but `vptr_d1 != vptr_c1`",
        "All three differ — every object gets its own vtable",
        "All three are equal — one global vtable",
        "vptrs can't be compared"
      ],
      answer: 0,
      explain: "The vtable is per-CLASS static data; every instance of Dog points at the one Dog vtable. Verified by reading the vptrs directly: d1 and d2 share an address, Cat's differs. (Educational only — ABI-specific, never do this in real code.)",
      section: 26
    },
    {
      type: "mc",
      level: "advanced",
      q: "`Duck : public Flyer, public Swimmer` (both bases polymorphic). Why do `Flyer* f = &duck` and `Swimmer* w = &duck` hold DIFFERENT addresses?",
      choices: [
        "Duck has TWO vptrs (one per base subobject); converting Duck* to Swimmer* silently adjusts `this` past the Flyer part",
        "One of the pointers is dangling",
        "They actually hold the same address",
        "Multiple inheritance copies the object"
      ],
      answer: 0,
      explain: "With multiple polymorphic bases, the object contains one base subobject (and vptr) per base — sizeof(Duck) is 16 vs 8 for one base. The Swimmer subobject starts 8 bytes in, so the compiler adjusts the pointer during conversion. Both still refer to the same Duck.",
      section: 26
    },
    {
      type: "mc",
      level: "advanced",
      q: "What's the difference between `typeid(*a1)` and `typeid(a1)` when `Animal* a1 = new Dog();`?",
      choices: [
        "`typeid(*a1)` is resolved at RUNTIME via RTTI → Dog; `typeid(a1)` is the pointer's static type → Animal*",
        "Both give Dog",
        "Both give Animal*",
        "`typeid` doesn't work on polymorphic types"
      ],
      answer: 0,
      explain: "Dereferencing gives a polymorphic glvalue, so typeid uses the same RTTI slot dynamic_cast uses → the REAL type (Dog). On the pointer itself it's compile-time static → Animal*. Note `.name()` returns a mangled string like \"3Dog\" — implementation-defined.",
      section: 26
    },
    {
      type: "fill",
      level: "beginner",
      q: "Which keyword must a base-class function have so a call through a base pointer dispatches to the derived override at runtime?",
      accept: ["virtual"],
      answerDisplay: "`virtual`",
      explain: "Without `virtual`, calls resolve at compile time from the pointer's static type (the most common polymorphism bug). `virtual` enables dynamic dispatch via the vtable.",
      section: 26
    },
    // ---- Section 27
    {
      type: "mc",
      level: "beginner",
      q: "What does `std::optional<T>` express, and how is it stored?",
      choices: [
        "'May or may not have a value', stored inline with no heap allocation",
        "A pointer that's always heap-allocated",
        "Exactly one of several types",
        "A thread-safe value"
      ],
      answer: 0,
      explain: "`std::optional<T>` holds 0 or 1 value inline (no heap). Use `has_value()`/`(bool)`, `*opt`/`.value()` (throws if empty), and `.value_or(default)` for a safe fallback — no more `-1`/`nullptr` sentinels.",
      example: "std::optional<int> found = 5;\nstd::optional<int> empty;\nfound.value_or(-1);   // 5\nempty.value_or(-1);   // -1  (no -1/nullptr sentinel needed)\nif (found) { /* *found == 5 */ }",
      section: 27
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `std::get<int>(v)` do when the variant currently holds a `std::string`?",
      code: "std::variant<int, double, std::string> v = std::string(\"hi\");\nstd::get<int>(v);",
      choices: [
        "Throws `std::bad_variant_access`",
        "Returns 0",
        "Returns the string reinterpreted as an int",
        "Returns nullptr"
      ],
      answer: 0,
      explain: "Accessing the wrong active alternative throws `std::bad_variant_access`. The non-throwing option is `std::get_if<int>(&v)`, which returns a pointer or `nullptr`. A variant holds exactly one active type at a time; `v.index()` tells you which.",
      section: 27
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does a default-constructed `std::variant<int, double, std::string> v;` hold?",
      choices: [
        "The FIRST alternative, default-constructed — an int of value 0, so `v.index()` is 0",
        "Nothing — it starts empty",
        "All three alternatives at once",
        "It doesn't compile without an initializer"
      ],
      answer: 0,
      explain: "A variant always holds exactly one alternative; default construction picks the FIRST one (which must be default-constructible — if it isn't, put `std::monostate` first to provide an empty-like state).",
      section: 27
    },
    {
      type: "mc",
      level: "intermediate",
      q: "How does `std::get_if<int>(&v)` differ from `std::get<int>(v)`?",
      choices: [
        "`get_if` never throws — it returns a pointer to the value, or `nullptr` if int isn't the active type",
        "They are identical",
        "`get_if` converts the value to int if needed",
        "`get_if` removes the value from the variant"
      ],
      answer: 0,
      explain: "`get_if` takes a POINTER to the variant and returns a pointer result: valid if that type is active, `nullptr` otherwise — perfect for `if (auto* p = std::get_if<std::string>(&v)) { ... }`. `get` returns a reference but throws `bad_variant_access` on mismatch.",
      example: "std::variant<int, std::string> v = std::string(\"hi\");\nif (auto* p = std::get_if<std::string>(&v)) {\n    // *p == \"hi\"\n}\nstd::get_if<int>(&v);   // nullptr (int isn't active)",
      section: 27
    },
    {
      type: "fill",
      level: "advanced",
      q: "What special type do you put FIRST in a variant so it's default-constructible when the real first alternative isn't?",
      accept: ["std::monostate", "monostate"],
      answerDisplay: "`std::monostate`",
      explain: "`std::monostate` is an empty, default-constructible placeholder. Putting it first (e.g. `variant<monostate, NoDefault>`) gives the variant a valid default/empty state.",
      section: 27
    },
    // ---- Section 28
    {
      type: "mc",
      level: "advanced",
      q: "In the `overloaded` pattern, why is `using Ts::operator()...;` required?",
      code: "template<class... Ts> struct overloaded : Ts... { using Ts::operator()...; };",
      choices: [
        "It merges every base lambda's `operator()` into one overload set — without it, calls are ambiguous",
        "It's just documentation and can be omitted",
        "It creates the deduction guide",
        "It makes the struct abstract"
      ],
      answer: 0,
      explain: "`overloaded` inherits from each lambda type. Without the using-declaration, calling `ov(5)` is ambiguous across the unrelated bases. `using Ts::operator()...;` pulls them all into one overload set so normal overload resolution picks the right one.",
      section: 28
    },
    {
      type: "mc",
      level: "advanced",
      q: "Conceptually, how does `std::visit(visitor, v)` dispatch?",
      choices: [
        "It switches on `v.index()` and calls `visitor(std::get<I>(v))` for the active I (jump-table style)",
        "It tries every type until one doesn't throw",
        "It uses exceptions to find the active type",
        "It always calls the first lambda"
      ],
      answer: 0,
      explain: "`std::visit` is essentially `switch (v.index()) { case I: visitor(get<I>(v)); }`, implemented with a generated jump table (similar mechanism to a vtable). It can also return a value and dispatch over multiple variants at once.",
      section: 28
    },
    {
      type: "mc",
      level: "advanced",
      q: "Are two lambdas with identical bodies the same type?",
      code: "auto lam1 = [](int x){ return x*2; };\nauto lam2 = [](int x){ return x*2; };",
      choices: [
        "No — every lambda has a unique compiler-generated closure type",
        "Yes — identical bodies produce identical types",
        "Only if they capture the same variables",
        "Only inside a template"
      ],
      answer: 0,
      explain: "Each lambda expression creates its own unique unnamed closure type, even if the code is identical. This is exactly why `overloaded` uses multiple inheritance — to combine several distinct lambda types into one object.",
      section: 28
    },
    {
      type: "mc",
      level: "advanced",
      q: "What is the deduction guide `template<class... Ts> overloaded(Ts...) -> overloaded<Ts...>;` for?",
      choices: [
        "It tells the compiler how to deduce Ts... from `overloaded{lambda1, lambda2}` — without it, CTAD fails to compile (pre-C++20)",
        "It defines the constructor",
        "It's an optional optimization hint",
        "It converts the lambdas to std::function"
      ],
      answer: 0,
      explain: "`overloaded` has no constructor — braced init relies on aggregate initialization, and the compiler still needs to know WHAT Ts... is. The deduction guide provides that rule. Verified: removing it gives 'class template argument deduction failed'.",
      section: 28
    },
    // ---- Section 29
    {
      type: "mc",
      level: "intermediate",
      q: "What does `std::expected<T, E>` hold, and what's its advantage over `std::optional<T>`?",
      choices: [
        "EITHER a success value T OR an error value E — so it carries WHY it failed, unlike optional",
        "Only a success value; errors go through exceptions",
        "A value plus a bool, always heap-allocated",
        "Exactly the same thing as optional"
      ],
      answer: 0,
      explain: "`std::expected<T, E>` (C++23) holds either a success `T` or an error `E`, inline and exception-free. Unlike `optional`, which only says something failed, `expected` carries the reason (E) right in the return type, visible to callers.",
      example: "std::expected<int, std::string> parse(const std::string& s) {\n    if (s == \"42\") return 42;\n    return std::unexpected(\"not a number\");\n}\nparse(\"42\").value_or(-1);   // 42\nparse(\"x\").value_or(-1);    // -1;  .error() == \"not a number\"",
      section: 29
    },
    // ---- Section 30
    {
      type: "mc",
      level: "intermediate",
      q: "What happens if a `std::thread` object is destroyed while still joinable (never joined or detached)?",
      code: "std::thread t(work);\n// no join(), no detach()\nreturn 0;   // t destroyed here",
      choices: [
        "`std::terminate()` is called — the whole program aborts",
        "The thread is silently detached",
        "The thread is silently joined",
        "Nothing; it's fine"
      ],
      answer: 0,
      explain: "A still-joinable thread being destroyed calls `std::terminate()` (SIGABRT). You must `join()` (block until done) or `detach()` before the thread object dies.",
      section: 30
    },
    {
      type: "mc",
      level: "intermediate",
      q: "How do you pass a variable by reference to a `std::thread`'s function, given args are copied by default?",
      code: "void increment(int& c) { c += 100; }\nstd::thread t(increment, ______ );",
      choices: [
        "`std::ref(counter)` — forces real reference semantics",
        "`&counter` — pass the address",
        "`std::move(counter)`",
        "Just `counter` — threads pass by reference by default"
      ],
      answer: 0,
      explain: "`std::thread` copies its arguments, so a plain `counter` can't bind to `int&` (compile error). `std::ref(counter)` wraps it so the thread really modifies the original.",
      example: "void increment(int& c) { c += 100; }\n\nint counter = 0;\nstd::thread t(increment, std::ref(counter));\nt.join();\n// counter -> 100  (without std::ref it stays 0)",
      section: 30
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which fix is lightest for a simple shared counter, guaranteeing an indivisible read-modify-write with no mutex?",
      choices: [
        "`std::atomic<int>`",
        "`std::mutex` + `std::lock_guard`",
        "`std::scoped_lock`",
        "`std::condition_variable`"
      ],
      answer: 0,
      explain: "`std::atomic<int>` makes `counter++` a single hardware-guaranteed atomic operation — ideal for simple counters/flags. A `mutex` + `lock_guard` also works but is heavier; `scoped_lock` is for locking multiple mutexes deadlock-free.",
      example: "std::atomic<int> n{0};      // safe across threads, no mutex\nn++;                        // atomic read-modify-write\nn += 5;\nn.load();                   // -> 6",
      section: 30
    },
    {
      type: "mc",
      level: "intermediate",
      q: "How do you get a RETURN VALUE back from concurrent work, which `std::thread` can't provide?",
      choices: [
        "`std::async` returns a `std::future<T>`; call `.get()` to block and retrieve the value",
        "Read `thread.result`",
        "Pass a return pointer to `std::thread`",
        "You can't — concurrent work never returns values"
      ],
      answer: 0,
      explain: "`std::thread` discards its function's return value. `std::async(std::launch::async, fn, args...)` returns a `std::future<T>`; `fut.get()` blocks until ready and returns the result — but only once (a second `.get()` throws `std::future_error`).",
      example: "int slowSquare(int x) { return x * x; }\n\nstd::future<int> fut =\n    std::async(std::launch::async, slowSquare, 12);\n// ... do other work while it runs ...\nint result = fut.get();   // blocks, then -> 144",
      section: 30
    },
    {
      type: "mc",
      level: "advanced",
      q: "What happens when you call `.get()` a SECOND time on the same `std::future`?",
      code: "std::future<int> fut = std::async(std::launch::async, slowSquare, 12);\nint a = fut.get();   // 144\nint b = fut.get();   // ?",
      choices: [
        "Throws `std::future_error` — the result was consumed and moved out on the first call",
        "Returns 144 again from a cache",
        "Blocks forever waiting for a new result",
        "Returns 0"
      ],
      answer: 0,
      explain: "`.get()` is one-time use: it moves the result out and disconnects the future from its shared state. Verified: the second call throws `std::future_error: No associated state`.",
      section: 30
    },
    {
      type: "mc",
      level: "advanced",
      q: "Why does `cv.wait(...)` require a `std::unique_lock` instead of a `std::lock_guard`?",
      code: "std::unique_lock<std::mutex> lock(mtx);\ncv.wait(lock, [] { return !q.empty() || done; });",
      choices: [
        "`wait` must UNLOCK the mutex while sleeping and RELOCK it on wake — lock_guard can't be unlocked mid-lifetime",
        "lock_guard is deprecated",
        "unique_lock is faster",
        "It's arbitrary; either works"
      ],
      answer: 0,
      explain: "While a thread sleeps in `cv.wait`, other threads must be able to take the mutex to produce data and notify. So wait() unlocks it, sleeps, and relocks on wake — operations `lock_guard` (acquire-on-construct, release-on-destruct only) doesn't support. The predicate form also guards against spurious wakeups.",
      section: 30
    },
    {
      type: "fill",
      level: "advanced",
      q: "Which C++17 lock locks multiple mutexes together with a deadlock-avoiding algorithm?",
      accept: ["std::scoped_lock", "scoped_lock"],
      answerDisplay: "`std::scoped_lock`",
      explain: "`std::scoped_lock(m1, m2, ...)` acquires several mutexes atomically using a deadlock-avoidance algorithm, so two threads requesting them in opposite orders won't deadlock.",
      example: "std::mutex mA, mB;\n{\n    std::scoped_lock lock(mA, mB);  // lock BOTH, deadlock-safe\n    // ... critical section touching both ...\n}   // both released here (RAII)",
      section: 30
    },
    // ---- Section 31
    {
      type: "mc",
      level: "beginner",
      q: "With multiple `catch` handlers, which one runs?",
      code: "try { divide(10, 0); }\ncatch (const std::invalid_argument& e) { ... }   // A\ncatch (const std::exception& e)        { ... }   // B",
      choices: [
        "The FIRST handler (top to bottom) whose type matches — here A",
        "The most recently written one",
        "All matching handlers run in order",
        "Always the std::exception handler"
      ],
      answer: 0,
      explain: "Handlers are tried top to bottom and the first match wins — so put specific types first and `catch (const std::exception&)` last, or the generic handler swallows everything. Always catch by const reference (no copy, no slicing).",
      section: 31
    },
    {
      type: "mc",
      level: "intermediate",
      q: "An exception is thrown from `deep()`. What happens to `r1` and `r2` before the catch runs?",
      code: "void deep()    { Resource r2(\"inner\"); throw std::runtime_error(\"boom\"); }\nvoid shallow() { Resource r1(\"outer\"); deep(); }\n\ntry { shallow(); } catch (const std::runtime_error& e) { ... }",
      choices: [
        "Both destructors run (inner first, then outer) BEFORE the handler — stack unwinding",
        "Neither destructor runs — the exception skips cleanup",
        "Only r1's destructor runs",
        "The destructors run after the catch block finishes"
      ],
      answer: 0,
      explain: "Stack unwinding destroys every local object in every abandoned scope, innermost first, before the handler executes — verified: 'release inner' then 'release outer' print before 'caught'. This is why RAII (unique_ptr, lock_guard) is exception-safe for free, while a manual `delete` line just gets skipped.",
      section: 31
    },
    {
      type: "mc",
      level: "advanced",
      q: "A function declared `noexcept` throws anyway. What happens?",
      code: "void risky() noexcept {\n    throw std::runtime_error(\"boom\");\n}\nrisky();",
      choices: [
        "`std::terminate()` — no unwinding to the caller; the program aborts (SIGABRT)",
        "The exception propagates normally",
        "The exception is silently swallowed",
        "It fails to compile"
      ],
      answer: 0,
      explain: "noexcept is a promise the runtime enforces the hard way: a throw escaping a noexcept function calls std::terminate(). Verified: GCC even warns '-Wterminate' at compile time, then the run aborts with exit code 134. This enforcement is why vector requires noexcept moves (section 10).",
      section: 31
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Inside a catch block, what's the difference between `throw;` and `throw e;`?",
      choices: [
        "`throw;` re-raises the SAME exception object; `throw e;` copies it as the declared type — slicing a derived exception",
        "They are identical",
        "`throw;` is a syntax error outside main",
        "`throw e;` is faster"
      ],
      answer: 0,
      explain: "Bare `throw;` rethrows the original object unchanged (verified: outer handler sees the same message). `throw e;` constructs a COPY typed as the handler's declared type — if the real exception was a derived class, the copy is sliced down to the base (section 26's slicing applied to exceptions).",
      section: 31
    },
    // ---- Section 32
    {
      type: "mc",
      level: "beginner",
      q: "What do these print?",
      code: "int x = 10, y = 20;\nauto byValue = [=]() { return x + y; };\nauto byRef   = [&]() { return x + y; };\nx = 100;\nbyValue();   // ?\nbyRef();     // ?",
      choices: [
        "`30` and `120` — `[=]` copied x at creation; `[&]` sees the live x",
        "`120` and `120` — both see the current values",
        "`30` and `30` — both captured at creation",
        "`120` and `30`"
      ],
      answer: 0,
      explain: "`[=]` copies the used variables INTO the closure at creation time (x was 10), so later changes are invisible. `[&]` stores references, so the call sees x = 100. Verified: 30 and 120.",
      section: 32
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Why does this fail to compile, and what fixes it?",
      code: "int counter = 0;\nauto count = [counter]() { return ++counter; };",
      choices: [
        "By-value captures are const by default — add `mutable` to modify the closure's own copy",
        "You can't capture ints by value",
        "++ is not allowed in lambdas",
        "counter must be captured by reference to compile"
      ],
      answer: 0,
      explain: "Verified error: 'increment of read-only variable'. `[counter]() mutable { return ++counter; }` compiles — and modifies only the CLOSURE's copy: three calls return 1 2 3 while the outer counter stays 0 (verified).",
      section: 32
    },
    {
      type: "mc",
      level: "advanced",
      q: "How do you get a `std::unique_ptr` INTO a lambda, given `[=]` would need to copy it?",
      choices: [
        "Init-capture with a move: `[p = std::move(ptr)]() { return *p; }`",
        "You can't — lambdas can't hold move-only types",
        "Capture it by reference and hope it lives long enough",
        "Call .release() and capture the raw pointer"
      ],
      answer: 0,
      explain: "C++14 init-capture creates a NEW closure member from any expression — including a move. Verified: the lambda owns the int (returns 42) and the original ptr is null afterward. `[=]` fails because unique_ptr's copy constructor is deleted (section 20).",
      example: "auto ptr = std::make_unique<int>(42);\nauto owner = [p = std::move(ptr)]() { return *p; };\nowner();            // 42  (the lambda now owns the int)\n// ptr == nullptr  (true)",
      section: 32
    },
    // ---- Section 33
    {
      type: "mc",
      level: "beginner",
      q: "What IS a `std::string_view`, and why use it for read-only string parameters?",
      choices: [
        "A non-owning {pointer, length} into existing characters — accepts literal/string/char* with zero copies",
        "A faster std::string that owns its data",
        "A null-terminated wrapper around char*",
        "A reference-counted string"
      ],
      answer: 0,
      explain: "string_view doesn't own or copy anything — it points into someone else's characters. A `const std::string&` parameter forces a temporary allocation when passed a literal; string_view wraps the existing chars directly (verified: same .data() pointer).",
      example: "void print(std::string_view sv) { std::cout << sv; }\nprint(\"a literal\");                 // no allocation\nstd::string s = \"hello world\";\nprint(s);                           // no copy\nstd::string_view(s).substr(0, 5);   // \"hello\" — O(1), no copy",
      section: 33
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What's the difference between these two substrings of a 1000-char string?",
      code: "std::string      a = big.substr(0, 500);\nstd::string_view b = std::string_view(big).substr(0, 500);",
      choices: [
        "`a` copies 500 chars into new memory; `b` is a view into big's buffer (verified via .data())",
        "Both copy",
        "Both share memory with big",
        "`b` is invalid — string_view has no substr"
      ],
      answer: 0,
      explain: "`std::string::substr` allocates and copies (verified: a.data() != big.data()); `string_view::substr` just narrows the pointer+length (verified: b.data() == big.data()). Slicing a view is O(1) pointer math — the same copy-vs-view distinction as NumPy slices vs list slices.",
      section: 33
    },
    {
      type: "mc",
      level: "advanced",
      q: "What's wrong with this line?",
      code: "std::string_view sv = std::string(\"temporary\");\nstd::cout << sv;",
      choices: [
        "The temporary string dies at the end of its line — sv is a dangling view, reading it is UB",
        "Nothing; string_view extends the temporary's lifetime",
        "It fails to compile",
        "sv silently makes a copy"
      ],
      answer: 0,
      explain: "A view must never outlive its owner, and binding to a temporary means the owner dies immediately (lifetime extension does NOT apply through string_view's pointer). Safe as a function parameter; dangerous as a member or return value. Also remember: .data() is not guaranteed null-terminated.",
      section: 33
    },
    // ---- Section 34
    {
      type: "mc",
      level: "beginner",
      q: "What are the TWO problems with plain `enum` that `enum class` fixes?",
      choices: [
        "Name leakage into the enclosing scope, and implicit conversion to int",
        "Slow comparisons and large storage",
        "They can't be used in switch statements",
        "They can't have explicit values"
      ],
      answer: 0,
      explain: "Plain enum: `Red` becomes a global name and `int c = Red;` / `Red < 5` silently work (verified). enum class: members must be qualified (`Status::Idle`) and `int i = st;` is a verified compile error — conversions require static_cast.",
      section: 34
    },
    {
      type: "fill",
      level: "intermediate",
      q: "Which named cast converts an `enum class Status` value to `int` (and back)?",
      accept: ["static_cast", "static_cast<int>", "std::static_cast"],
      answerDisplay: "`static_cast`",
      explain: "enum class has no implicit int conversion, so both directions are explicit: `static_cast<int>(st)` and `static_cast<Status>(2)` — both verified. That explicitness is the type-safety point.",
      example: "enum class Status { Idle, Running, Done };\nStatus s = Status::Running;\nint i = static_cast<int>(s);            // 1\nStatus back = static_cast<Status>(2);   // Status::Done",
      section: 34
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does `: std::uint8_t` do here?",
      code: "enum class Status : std::uint8_t { Idle, Running, Done };\nsizeof(Status);   // ?",
      choices: [
        "Sets the underlying storage type — sizeof(Status) is 1 instead of the default 4",
        "Limits the enum to 8 members",
        "Makes the members unsigned strings",
        "Nothing; it's a comment"
      ],
      answer: 0,
      explain: "The `: type` suffix picks the underlying integer type. Verified: sizeof(Status) == 1 vs sizeof of a default (int-backed) enum == 4. Useful for packed structs, network formats, and huge arrays of enums.",
      section: 34
    },
    // ---- Section 35
    {
      type: "mc",
      level: "beginner",
      q: "Which cast is right for an intentional double→int conversion?",
      code: "double pi = 3.99;\nint t = ____(pi);   // want 3",
      choices: [
        "`static_cast<int>` — related-type conversion, compile-time checked",
        "`reinterpret_cast<int>`",
        "`const_cast<int>`",
        "`dynamic_cast<int>`"
      ],
      answer: 0,
      explain: "static_cast handles sensible related-type conversions (numeric, up/down hierarchy, void*). Verified: static_cast<int>(3.99) == 3. reinterpret_cast re-labels bits, const_cast changes constness, dynamic_cast is for polymorphic downcasts only.",
      section: 35
    },
    {
      type: "mc",
      level: "intermediate",
      q: "Which is the ONLY cast that can remove const, and when is writing through it legal?",
      choices: [
        "`const_cast` — legal only if the underlying object was NOT declared const",
        "`static_cast` — always legal",
        "`reinterpret_cast` — legal for ints only",
        "No cast can remove const"
      ],
      answer: 0,
      explain: "Only const_cast changes const-ness. Verified: writing through `const_cast<int&>(cref)` works because the underlying `int real` isn't const. If the object itself was declared const, writing through the cast is undefined behavior (section 23's caveat).",
      section: 35
    },
    {
      type: "mc",
      level: "advanced",
      q: "Why is the C-style cast dangerous here, given the named cast refuses?",
      code: "int x = 42;\ndouble* dp1 = (double*)&x;               // compiles!\ndouble* dp2 = static_cast<double*>(&x);  // error",
      choices: [
        "The C-style cast silently escalates down the cast ladder to reinterpret_cast, hiding a real error",
        "The C-style cast is slower",
        "The C-style cast rounds the value",
        "static_cast is wrong; the C-style version is correct"
      ],
      answer: 0,
      explain: "A C-style cast tries const_cast → static_cast → static_cast+const_cast → reinterpret_cast until something compiles. Verified: static_cast correctly errors ('invalid static_cast from int* to double*'), while (double*)&x silently becomes a reinterpret_cast — UB waiting to happen. Named casts also make casts greppable.",
      section: 35
    },
    // ---- Section 36
    {
      type: "mc",
      level: "beginner",
      q: "When can a `constexpr` function run?",
      code: "constexpr int factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }",
      choices: [
        "Both at compile time (constant args — e.g. array sizes, static_assert) AND as a normal runtime function",
        "Only at compile time",
        "Only at runtime",
        "Only inside templates"
      ],
      answer: 0,
      explain: "constexpr means CAN run at compile time, not must. Verified both worlds: `std::array<int, factorial(4)>` (24 elements, compile time) and `factorial(runtime_n)` returning 720 at runtime. `consteval` is the compile-time-ONLY variant.",
      example: "constexpr int factorial(int n) { return n<=1 ? 1 : n*factorial(n-1); }\nconstexpr int f = factorial(5);   // 120, at COMPILE time\nstatic_assert(f == 120);\nint k = 6;\nfactorial(k);                     // 720, at RUNTIME (same fn)",
      section: 36
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What happens when a `consteval` function gets a runtime argument?",
      code: "consteval int square(int n) { return n * n; }\nint runtime_n = 7;\nsquare(runtime_n);",
      choices: [
        "Compile error — consteval functions MUST be evaluated at compile time",
        "It runs at runtime like a normal function",
        "It returns 0",
        "Undefined behavior"
      ],
      answer: 0,
      explain: "consteval = 'immediate function': every call must produce a compile-time constant. Verified error: 'the value of runtime_n is not usable in a constant expression'. `square(9)` is fine (81) because 9 is a constant.",
      section: 36
    },
    {
      type: "mc",
      level: "advanced",
      q: "How does `if constexpr` differ from a plain `if` inside a template?",
      code: "template <typename T>\nstd::string describe(T) {\n    if constexpr (std::is_integral_v<T>) return \"integral\";\n    else return \"something else\";\n}",
      choices: [
        "The untaken branch is DISCARDED at compile time — it may even contain code invalid for that T",
        "It's just a style preference; both compile identically",
        "if constexpr runs faster at runtime but both branches compile",
        "It only works with integers"
      ],
      answer: 0,
      explain: "With plain `if`, BOTH branches must compile for every T. `if constexpr` selects the branch during compilation and throws the other away — enabling per-type code paths without template specialization. Verified: describe(42)/describe(3.14)/describe(\"hi\") → integral/floating/something else.",
      section: 36
    },
    // ---- Section 37
    {
      type: "mc",
      level: "intermediate",
      q: "What do C++20 concepts improve about this failing call?",
      code: "template <typename T> concept Numeric = std::integral<T> || std::floating_point<T>;\nNumeric auto add(Numeric auto a, Numeric auto b) { return a + b; }\n\nadd(std::string(\"a\"), std::string(\"b\"));   // fails",
      choices: [
        "The error happens AT THE CALL SITE and names the violated constraint (Numeric) — not pages of template spew",
        "The call compiles and returns \"ab\"",
        "Concepts make the call fail at runtime instead",
        "Nothing; the error is identical to unconstrained templates"
      ],
      answer: 0,
      explain: "Verified error: 'no matching function... requires Numeric<...>' — the constraint is named right where you called it. Unconstrained templates fail deep inside the implementation with notoriously unreadable errors. Concepts are compile-time duck typing, like a checkable typing.Protocol.",
      section: 37
    },
    {
      type: "mc",
      level: "intermediate",
      q: "What does this ranges pipeline print for nums = {1..10}?",
      code: "auto result = nums\n    | std::views::filter([](int n){ return n % 2 == 0; })\n    | std::views::transform([](int n){ return n * n; })\n    | std::views::take(3);\nfor (int n : result) std::cout << n << \" \";",
      choices: [
        "`4 16 36` — evens (2,4,6), squared, first three",
        "`1 4 9` — first three squared",
        "`2 4 6` — first three evens",
        "`4 16 36 64 100` — all evens squared"
      ],
      answer: 0,
      explain: "The pipeline reads left to right: keep evens → square → take 3. Verified output: 4 16 36. Views compose with `|` like a shell pipeline, replacing nested iterator-pair calls.",
      example: "std::vector<int> v{1, 2, 3, 4, 5, 6};\n// nums | views::filter(p)  ==  views::filter(nums, p)\nauto evens = v | std::views::filter([](int n){ return n%2==0; });\nfor (int n : evens) std::cout << n << \" \";   // 2 4 6",
      section: 37
    },
    {
      type: "mc",
      level: "advanced",
      q: "A filter view was created, THEN the vector was mutated. What does iterating the view show?",
      code: "auto evens = nums | std::views::filter(isEven);   // nums = {1..10}\nnums[1] = 999;                                    // the 2 becomes 999\nfor (int n : evens) ...",
      choices: [
        "`4 6 8 10` — views are LAZY and reference the container, so the mutated 2 is gone",
        "`2 4 6 8 10` — the view snapshotted the data at creation",
        "Undefined behavior — views can't outlive mutations",
        "An exception is thrown"
      ],
      answer: 0,
      explain: "Views don't copy — they re-read the underlying container at ITERATION time. Verified: after nums[1]=999, the former 2 fails the filter and the output is 4 6 8 10. Same lazy model as Python generators, same lifetime care as string_view. (That's also why infinite `views::iota(1) | take(5)` works — verified 1 2 3 4 5.)",
      section: 37
    },
    // ---- Code-assembly questions ----
    {
      type: "assemble", level: "intermediate", section: 30,
      q: "Launch `work(12)` asynchronously and get its return value back.",
      template: "std::{#}<int> fut = std::{#}(std::launch::async, work, 12);\nint result = fut.{#}();",
      blanks: ["future","async","get"],
      distractors: ["thread","promise","join"],
      explain: "std::async runs work concurrently and hands back a std::future<int>; fut.get() blocks until it's ready and returns the value (144). std::thread can't return a value; join()/detach() are thread methods."
    },
    {
      type: "assemble", level: "beginner", section: 20,
      q: "Create a Widget owned by a unique_ptr and call `greet()` through the pointer.",
      template: "std::{#}<Widget> p = std::{#}<Widget>(42);\np{#}greet();",
      blanks: ["unique_ptr","make_unique","->"],
      distractors: ["shared_ptr","make_shared","."],
      explain: "make_unique builds the object and returns a unique_ptr (exclusive ownership). Access members through a pointer with -> (p->greet() means (*p).greet()), not the dot operator."
    },
    {
      type: "assemble", level: "beginner", section: 20,
      q: "Make a shared int, share ownership with a copy, then read the reference count.",
      template: "auto a = std::{#}<int>(7);\nauto b = a;               // share ownership\nstd::cout << a.{#}();   // 2",
      blanks: ["make_shared","use_count"],
      distractors: ["make_unique","count","size"],
      explain: "make_shared creates a reference-counted shared_ptr; copying it (b = a) bumps the count. use_count() reports how many shared_ptrs own the object — 2 here."
    },
    {
      type: "assemble", level: "intermediate", section: 15,
      q: "Sum a vector with std::accumulate over its full range.",
      template: "std::vector<int> v{1, 2, 3, 4};\nint sum = std::{#}(v.{#}(), v.{#}(), 0);   // 10",
      blanks: ["accumulate","begin","end"],
      distractors: ["reduce","rbegin","size"],
      explain: "std::accumulate folds the range [begin, end) starting from the init value 0 -> 10. The init argument's type is the accumulator type (use 0.0 to sum as double)."
    },
    {
      type: "assemble", level: "beginner", section: 27,
      q: "Hold an optional int and read it with a fallback of -1 when empty.",
      template: "std::{#}<int> maybe = 5;\nstd::cout << maybe.{#}(-1);   // 5  (or -1 if empty)",
      blanks: ["optional","value_or"],
      distractors: ["variant","expected","value"],
      explain: "std::optional<int> holds 0-or-1 value inline. value_or(-1) returns the value if present, otherwise the fallback — and never throws, unlike value()."
    },
    {
      type: "assemble", level: "intermediate", section: 27,
      q: "Safely read the active std::string out of a variant without throwing.",
      template: "std::{#}<int, std::string> v = std::string(\"hi\");\nif (auto* p = std::{#}<std::string>(&v)) std::cout << *p;",
      blanks: ["variant","get_if"],
      distractors: ["optional","get","holds_alternative"],
      explain: "get_if takes a POINTER to the variant and returns a pointer to the value if that type is active, else nullptr — the non-throwing alternative to get (which throws bad_variant_access on a type mismatch)."
    },
    {
      type: "assemble", level: "intermediate", section: 30,
      q: "Make a thread-safe counter that increments without a mutex.",
      template: "std::{#}<int> counter{0};\ncounter{#};   // atomic read-modify-write",
      blanks: ["atomic","++"],
      distractors: ["mutex","--","store"],
      explain: "std::atomic<int> makes counter++ a single indivisible hardware operation — safe across threads with no mutex. Ideal for simple counters and flags."
    },
    {
      type: "assemble", level: "beginner", section: 30,
      q: "Launch `worker(42)` on a new thread and WAIT for it to finish.",
      template: "std::{#} t(worker, 42);   // launch\nt.{#}();                  // wait for it to finish",
      blanks: ["thread","join"],
      distractors: ["future","async","detach","get"],
      explain: "std::thread starts running immediately; join() blocks until it finishes (detach() would let it run unwaited). Forgetting both before the thread object is destroyed calls std::terminate()."
    },
    {
      type: "assemble", level: "intermediate", section: 33,
      q: "View a string literal without copying, then take a zero-copy 'hello' substring.",
      template: "std::{#} sv = \"hello world\";\nstd::cout << sv.{#}(0, 5);   // hello",
      blanks: ["string_view","substr"],
      distractors: ["string","substring","slice"],
      explain: "string_view is a non-owning {pointer, length}; assigning a literal copies nothing. Its substr(0, 5) just narrows the view (O(1)), unlike std::string::substr which allocates a copy."
    },
    {
      type: "assemble", level: "intermediate", section: 34,
      q: "Convert a scoped-enum (`enum class`) value to its underlying int.",
      template: "enum class Status { Idle, Running, Done };\nStatus s = Status::Running;\nint i = {#}<int>(s);   // 1",
      blanks: ["static_cast"],
      distractors: ["reinterpret_cast","const_cast","dynamic_cast"],
      explain: "enum class has no implicit int conversion, so you convert explicitly with static_cast<int>(s) -> 1 (and static_cast<Status>(1) back). static_cast handles sensible related-type conversions."
    },
    {
      type: "assemble", level: "advanced", section: 20,
      q: "Observe a shared object without owning it, then access it safely.",
      template: "auto s = std::make_shared<int>(7);\nstd::{#}<int> w = s;   // non-owning observer\nif (auto locked = w.{#}()) std::cout << *locked;",
      blanks: ["weak_ptr","lock"],
      distractors: ["shared_ptr","unique_ptr","get","expired"],
      explain: "weak_ptr observes a shared_ptr without bumping the reference count (this breaks cycles). lock() returns a temporary shared_ptr — valid if the object is still alive, empty if it's gone — so access is always safe."
    },
    {
      type: "assemble", level: "beginner", section: 12,
      q: "Build a vector by appending two ints, then print them (the same token fills two blanks).",
      template: "std::{#}<int> v;\nv.{#}(10);\nv.{#}(20);\nfor (int x : v) std::cout << x;   // 1020",
      blanks: ["vector","push_back","push_back"],
      distractors: ["array","append","insert"],
      explain: "std::vector is the default dynamic array; push_back appends to the end (amortized O(1)). Note the SAME token fills two blanks — the bank provides two push_back tiles."
    },
    {
      type: "assemble", level: "intermediate", section: 36,
      q: "Force `factorial(5)` to be computed at compile time.",
      template: "constexpr int factorial(int n) { return n <= 1 ? 1 : n * factorial(n-1); }\n{#} int f = factorial(5);   // 120, at COMPILE time\nstatic_assert(f == 120);",
      blanks: ["constexpr"],
      distractors: ["const","consteval","static"],
      explain: "A constexpr variable must have a compile-time value, forcing factorial(5) to run during compilation -> 120 baked into the binary (static_assert proves it). Plain const could hold a runtime value."
    },
    {
      type: "assemble", level: "beginner", section: 7,
      q: "Move a vector's contents into another, leaving the source empty.",
      template: "std::vector<int> a{1, 2, 3};\nstd::vector<int> b = std::{#}(a);   // steal a's buffer\n// a.size() is now 0",
      blanks: ["move"],
      distractors: ["copy","forward","ref"],
      explain: "std::move is just a cast to an rvalue reference; it lets vector's move constructor steal a's internal buffer into b, leaving a empty (size 0). std::move itself moves nothing."
    }
,
    // ---- Advanced code-assembly (multi-topic) ----
    {
      type: "assemble", level: "advanced", section: 26,
      q: "Polymorphism through a vector of unique_ptr: mark the override, build the Circle, and dispatch through the pointer.",
      template: "struct Shape {\n    virtual double area() const = 0;   // pure virtual\n    virtual ~Shape() = default;\n};\nstruct Circle : Shape {\n    double r;\n    Circle(double r_) : r(r_) {}\n    double area() const {#} { return 3.14159 * r * r; }\n};\n\nstd::vector<std::unique_ptr<Shape>> shapes;\nshapes.push_back(std::{#}<Circle>(2.0));\ndouble total = 0;\nfor (const auto& s : shapes)\n    total += s{#}area();     // virtual call THROUGH the pointer\n// total == 12.5664",
      blanks: ["override","make_unique","->"],
      distractors: ["virtual","make_shared","."],
      explain: "area() marked override is the derived version; make_unique<Circle> stores a Circle inside a unique_ptr<Shape>; s->area() makes the virtual call through the pointer (12.5664). make_shared wouldn't fit the unique_ptr vector, and s.area() fails because unique_ptr itself has no area()."
    },
    {
      type: "assemble", level: "advanced", section: 30,
      q: "Run a task that owns a moved-in unique_ptr on another thread and collect its result. (One token is used twice.)",
      template: "auto data = std::make_unique<int>(21);\nstd::future<int> fut = std::{#}(std::launch::{#},\n    [p = std::{#}(data)]() { return *p * 2; });   // move the unique_ptr INTO the closure\nint result = fut.{#}();    // blocks, then 42",
      blanks: ["async","async","move","get"],
      distractors: ["thread","sync","forward","wait"],
      explain: "std::async launches the lambda with std::launch::async (forced concurrency) and returns a future<int>. The init-capture [p = std::move(data)] MOVES the non-copyable unique_ptr into the closure. fut.get() blocks and returns 42. std::thread returns no value; 'sync' isn't a launch policy (async/deferred are)."
    },
    {
      type: "assemble", level: "advanced", section: 28,
      q: "Build the `overloaded` helper and use std::visit to dispatch on a variant's active alternative.",
      template: "template<class... Ts> struct overloaded : Ts... { using Ts::{#}...; };\ntemplate<class... Ts> overloaded(Ts...) -> {#}<Ts...>;   // deduction guide\n\nstd::variant<int, double, std::string> v = 3.14;\nstd::{#}(overloaded{\n    [](int i)                { std::cout << \"int \" << i; },\n    [](double d)             { std::cout << \"double \" << d; },\n    [](const std::string& s) { std::cout << \"str \" << s; }\n}, v);\n// prints: double 3.14",
      blanks: ["operator()","overloaded","visit"],
      distractors: ["operator","variant","get","apply"],
      explain: "using Ts::operator()... merges every lambda's call operator into one overload set; the deduction guide -> overloaded<Ts...> lets overloaded{...} deduce its template types. std::visit then calls the lambda matching the active alternative (double 3.14)."
    },
    {
      type: "assemble", level: "advanced", section: 10,
      q: "Complete the move constructor and move assignment of a resource-owning class (Rule of 5).",
      template: "class Buffer {\n    int* data_; size_t n_;\npublic:\n    Buffer(size_t n) : data_(new int[n]{}), n_(n) {}\n    ~Buffer() { delete[] data_; }\n\n    Buffer(Buffer&& o) {#} : data_(o.data_), n_(o.n_) {   // move constructor\n        o.data_ = {#};          // leave the source safe to destroy\n        o.n_ = 0;\n    }\n    Buffer& operator=(Buffer&& o) noexcept {\n        if (this {#} &o) {                    // guard self-assignment\n            delete[] data_;\n            data_ = o.data_; n_ = o.n_;\n            o.data_ = nullptr; o.n_ = 0;\n        }\n        return {#};\n    }\n};",
      blanks: ["noexcept","nullptr","!=","*this"],
      distractors: ["const","delete","==","this"],
      explain: "Move ops are marked noexcept so STL containers use them on reallocation. The move ctor steals the pointer and nulls the source (nullptr) so its destructor's delete[] is harmless. Move assignment guards `this != &o` against self-move, then returns *this — `this` alone would return a pointer, not a Buffer&."
    },
    {
      type: "assemble", level: "advanced", section: 37,
      q: "Define a `concept` and use a requires-clause to constrain a generic sum function.",
      template: "template <typename T>\n{#} Numeric = std::is_arithmetic_v<T>;   // a named constraint\n\ntemplate <typename T>\n{#} (Numeric<T>)                          // constrain T\nT total(const std::vector<T>& v) {\n    return std::{#}(v.begin(), v.end(), T{});\n}\n// total(std::vector<int>{1, 2, 3}) == 6",
      blanks: ["concept","requires","accumulate"],
      distractors: ["constexpr","typename","transform","count"],
      explain: "concept Numeric = is_arithmetic_v<T> names a compile-time constraint; the requires (Numeric<T>) clause rejects non-numeric T right at the call site with a readable error. std::accumulate folds [begin, end) from T{} (0) -> 6."
    },
    {
      type: "assemble", level: "advanced", section: 30,
      q: "Wire up a condition-variable handoff: the consumer sleeps until the producer signals.",
      template: "std::mutex m;\nstd::condition_variable cv;\nstd::queue<int> q;\nbool ready = false;\n\n// consumer:\nstd::{#}<std::mutex> lk(m);       // cv.wait needs THIS lock type\ncv.{#}(lk, []{ return ready; });  // release lock & sleep until the predicate is true\nint val = q.front(); q.pop();\n\n// producer (another thread):\n{ std::lock_guard<std::mutex> g(m); q.push(42); ready = true; }\ncv.{#}();     // wake one waiter",
      blanks: ["unique_lock","wait","notify_one"],
      distractors: ["lock_guard","scoped_lock","wait_for","signal"],
      explain: "cv.wait must unlock and relock the mutex while sleeping, so it needs a std::unique_lock — a lock_guard/scoped_lock won't compile there. wait(lock, predicate) sleeps until the predicate holds (also guards spurious wakeups). notify_one() wakes one waiter after the push. wait_for needs a timeout; 'signal' isn't a member."
    },
    {
      type: "assemble", level: "advanced", section: 29,
      q: "Chain a parse through std::expected's monadic operations (transform then and_then).",
      template: "std::expected<int, std::string> parse(const std::string& s) {\n    if (s == \"42\") return 42;\n    return std::{#}(std::string(\"NaN\"));    // build the ERROR value\n}\n\nauto r = parse(\"42\")\n    .{#}([](int n) { return n + 8; })        // n stays an int -> 50, still success\n    .{#}([](int n) -> std::expected<int, std::string> {\n        if (n >= 50) return n;\n        return std::unexpected(std::string(\"small\"));\n    });                                       // continue only if still successful\n// r.value() == 50",
      blanks: ["unexpected","transform","and_then"],
      distractors: ["expected","map","or_else","value_or"],
      explain: "std::unexpected wraps the error branch. transform maps the success value (int -> int) and re-wraps it automatically; and_then takes a function that ITSELF returns an expected, so it goes where the lambda returns expected<int,string>. Swap the two and the types no longer line up. or_else handles the error branch instead."
    },
    {
      type: "assemble", level: "advanced", section: 30,
      q: "Sum 0..99 across four threads accumulating into an atomic.",
      template: "std::atomic<long> total{0};\nstd::vector<std::thread> workers;\nfor (int t = 0; t < 4; ++t)\n    workers.{#}([&total, t] {                 // build the thread IN PLACE from the lambda\n        for (int i = t; i < 100; i += 4)\n            total {#} i;                       // safe concurrent accumulate\n    });\nfor (auto& w : workers) w.{#}();               // wait for all four\n// total == 4950",
      blanks: ["emplace_back","+=","join"],
      distractors: ["push_back","+","=","detach"],
      explain: "emplace_back constructs the std::thread in place from the lambda (push_back needs an already-built thread — a lambda won't implicitly convert). total += i is an atomic read-modify-write, so no data race (total + i discards the result; = would race). join() waits for each thread before total is read (4950); detach would race with that read."
    },
    {
      type: "assemble", level: "advanced", section: 14,
      q: "Copy a map's entries into a vector and sort them by value (highest first), then print via structured bindings.",
      template: "std::map<std::string, int> scores{{\"amy\", 3}, {\"bob\", 5}, {\"cid\", 1}};\nstd::vector<std::pair<std::string, int>> v(scores.{#}(), scores.end());   // copy entries out\n\nstd::{#}(v.begin(), v.end(),\n    [](const auto& a, const auto& b) { return a.second {#} b.second; });   // by score, DESCENDING\n\nfor (const auto{#} [name, score] : v)\n    std::cout << name << score;    // bob5amy3cid1",
      blanks: ["begin","sort",">","&"],
      distractors: ["data","for_each","<","&&"],
      explain: "v(scores.begin(), scores.end()) range-constructs the vector of pairs. std::sort with a comparator returning a.second > b.second orders descending (< would be ascending). const auto& [name, score] binds each pair by reference — const auto&& can't bind these lvalue elements."
    },
    {
      type: "assemble", level: "advanced", section: 13,
      q: "Write a variadic factory that perfectly forwards its arguments to construct a T in a unique_ptr. (One token is used twice.)",
      template: "template <typename T, typename{#} Args>          // Args is a parameter PACK\nstd::{#}<T> create(Args&&... args) {\n    return std::make_unique<T>(std::{#}<Args>(args){#});   // perfect-forward & expand\n}\n\nstruct Point { int x, y; Point(int a, int b) : x(a), y(b) {} };\nauto p = create<Point>(3, 4);\n// p->x == 3, p->y == 4",
      blanks: ["...","unique_ptr","forward","..."],
      distractors: ["&","weak_ptr","copy",";"],
      explain: "typename... Args declares a parameter pack; std::forward<Args>(args)... forwards each argument preserving its value category, and the trailing ... expands the pack. make_unique<T> returns a unique_ptr<T>, so that's the return type. weak_ptr can't own the object; copy/move would break perfect forwarding."
    }

  ]
};
