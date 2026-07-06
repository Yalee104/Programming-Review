// C++ quiz — questions map to sections of cpp_study_summary.md
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
    30: "Callables + std::thread + Synchronization"
  },
  questions: [
    // ---- Section 1
    {
      type: "mc",
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
    // ---- Section 2
    {
      type: "mc",
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
      q: "In `virtual void describe() const override = 0;`, which two characters at the end make the method **pure virtual** (subclass must implement)?",
      accept: ["= 0", "=0", "0"],
      answerDisplay: "`= 0`",
      explain: "`= 0` marks the function pure virtual — the class becomes abstract and every concrete subclass must provide an implementation.",
      section: 2
    },
    // ---- Section 3
    {
      type: "mc",
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
    // ---- Section 4
    {
      type: "mc",
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
      q: "What kind of value has a name and an address that persists — the opposite of an rvalue? (one word)",
      accept: ["lvalue", "an lvalue"],
      answerDisplay: "an `lvalue`",
      explain: "An lvalue has a name and an address you can take with `&`. An rvalue is a temporary with no name and no address (`&5` is illegal).",
      section: 5
    },
    // ---- Section 6
    {
      type: "mc",
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
    // ---- Section 7
    {
      type: "mc",
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
    // ---- Section 8
    {
      type: "mc",
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
      q: "Which 'Rule of N' is the modern recommended default — own no raw resources and let the compiler generate everything? (a number)",
      accept: ["0", "rule of 0", "zero", "rule of zero"],
      answerDisplay: "Rule of 0",
      explain: "Rule of 0: hold resources in types that manage themselves (e.g. `std::unique_ptr`, `std::vector`) so you write none of the five special members. The compiler handles everything correctly.",
      section: 8
    },
    // ---- Section 9
    {
      type: "mc",
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
    // ---- Section 10
    {
      type: "mc",
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
      q: "Which specifier must a move constructor have for STL containers (like vector on reallocation) to prefer moving over copying?",
      accept: ["noexcept"],
      answerDisplay: "`noexcept`",
      explain: "Containers only use your move constructor during reallocation if it's `noexcept` — otherwise they fall back to copying to preserve the strong exception guarantee.",
      section: 10
    },
    // ---- Section 11
    {
      type: "mc",
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
      type: "fill",
      q: "Which STL container is the default go-to dynamic array?",
      accept: ["std::vector", "vector"],
      answerDisplay: "`std::vector`",
      explain: "`std::vector<T>` is the default choice — a contiguous dynamic array with O(1) indexing and amortized O(1) push_back.",
      section: 12
    },
    // ---- Section 13
    {
      type: "mc",
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
    // ---- Section 14
    {
      type: "mc",
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
      section: 14
    },
    // ---- Section 15
    {
      type: "mc",
      q: "What determines the return type of `std::accumulate(v.begin(), v.end(), init)`?",
      choices: [
        "The type of the `init` argument",
        "The element type of the container",
        "Always `int`",
        "The iterator category"
      ],
      answer: 0,
      explain: "The accumulator (and return) type is the type of `init`. `accumulate(b, e, 0)` returns int; `accumulate(b, e, 0.0)` returns double — a classic bug source when summing doubles with an int seed.",
      section: 15
    },
    // ---- Section 16
    {
      type: "mc",
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
    // ---- Section 18
    {
      type: "mc",
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
    // ---- Section 20
    {
      type: "mc",
      q: "What happens to `p1` after `std::unique_ptr<Dog> p2 = std::move(p1);`?",
      choices: [
        "`p1` becomes null — ownership is transferred, not duplicated",
        "`p1` and `p2` both own the Dog",
        "It's a compile error",
        "`p1` still owns the Dog; `p2` is null"
      ],
      answer: 0,
      explain: "`unique_ptr` is move-only. Moving transfers sole ownership: `p1 == nullptr` afterward, `p2` is the owner. Copying (`unique_ptr b = p2;`) is a compile error — the copy constructor is deleted.",
      section: 20
    },
    {
      type: "mc",
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
      type: "fill",
      q: "Which factory function should you prefer over `new` to create a `unique_ptr<T>`?",
      accept: ["std::make_unique", "make_unique", "std::make_unique<T>", "make_unique<T>"],
      answerDisplay: "`std::make_unique`",
      explain: "`std::make_unique<T>(args...)` is exception-safe and less error-prone than raw `new`. (`std::make_shared` is the shared_ptr equivalent, and also allocates the control block in the same allocation as the object.)",
      section: 20
    },
    // ---- Section 21
    {
      type: "mc",
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
      q: "Which keyword lets a data member be modified even inside a `const` member function?",
      accept: ["mutable"],
      answerDisplay: "`mutable`",
      explain: "A `mutable` member (e.g. a cache counter) can be changed even through a const method or on a const object — the escape hatch for logically-const-but-physically-changing state.",
      section: 22
    },
    // ---- Section 23
    {
      type: "mc",
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
      q: "An object that overloads `operator()` so it can be 'called like a function' is commonly called a ______.",
      accept: ["functor", "function object", "a functor", "function-object"],
      answerDisplay: "functor (function object)",
      explain: "A class with `operator()` (like `Multiplier` where `times3(7)` gives 21) is a functor. Lambdas are compiler-generated functors.",
      section: 24
    },
    // ---- Section 25
    {
      type: "mc",
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
    // ---- Section 26
    {
      type: "mc",
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
      type: "fill",
      q: "Which keyword must a base-class function have so a call through a base pointer dispatches to the derived override at runtime?",
      accept: ["virtual"],
      answerDisplay: "`virtual`",
      explain: "Without `virtual`, calls resolve at compile time from the pointer's static type (the most common polymorphism bug). `virtual` enables dynamic dispatch via the vtable.",
      section: 26
    },
    // ---- Section 27
    {
      type: "mc",
      q: "What does `std::optional<T>` express, and how is it stored?",
      choices: [
        "'May or may not have a value', stored inline with no heap allocation",
        "A pointer that's always heap-allocated",
        "Exactly one of several types",
        "A thread-safe value"
      ],
      answer: 0,
      explain: "`std::optional<T>` holds 0 or 1 value inline (no heap). Use `has_value()`/`(bool)`, `*opt`/`.value()` (throws if empty), and `.value_or(default)` for a safe fallback — no more `-1`/`nullptr` sentinels.",
      section: 27
    },
    {
      type: "mc",
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
      type: "fill",
      q: "What special type do you put FIRST in a variant so it's default-constructible when the real first alternative isn't?",
      accept: ["std::monostate", "monostate"],
      answerDisplay: "`std::monostate`",
      explain: "`std::monostate` is an empty, default-constructible placeholder. Putting it first (e.g. `variant<monostate, NoDefault>`) gives the variant a valid default/empty state.",
      section: 27
    },
    // ---- Section 28
    {
      type: "mc",
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
    // ---- Section 29
    {
      type: "mc",
      q: "What does `std::expected<T, E>` hold, and what's its advantage over `std::optional<T>`?",
      choices: [
        "EITHER a success value T OR an error value E — so it carries WHY it failed, unlike optional",
        "Only a success value; errors go through exceptions",
        "A value plus a bool, always heap-allocated",
        "Exactly the same thing as optional"
      ],
      answer: 0,
      explain: "`std::expected<T, E>` (C++23) holds either a success `T` or an error `E`, inline and exception-free. Unlike `optional`, which only says something failed, `expected` carries the reason (E) right in the return type, visible to callers.",
      section: 29
    },
    // ---- Section 30
    {
      type: "mc",
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
      section: 30
    },
    {
      type: "mc",
      q: "Which fix is lightest for a simple shared counter, guaranteeing an indivisible read-modify-write with no mutex?",
      choices: [
        "`std::atomic<int>`",
        "`std::mutex` + `std::lock_guard`",
        "`std::scoped_lock`",
        "`std::condition_variable`"
      ],
      answer: 0,
      explain: "`std::atomic<int>` makes `counter++` a single hardware-guaranteed atomic operation — ideal for simple counters/flags. A `mutex` + `lock_guard` also works but is heavier; `scoped_lock` is for locking multiple mutexes deadlock-free.",
      section: 30
    },
    {
      type: "mc",
      q: "How do you get a RETURN VALUE back from concurrent work, which `std::thread` can't provide?",
      choices: [
        "`std::async` returns a `std::future<T>`; call `.get()` to block and retrieve the value",
        "Read `thread.result`",
        "Pass a return pointer to `std::thread`",
        "You can't — concurrent work never returns values"
      ],
      answer: 0,
      explain: "`std::thread` discards its function's return value. `std::async(std::launch::async, fn, args...)` returns a `std::future<T>`; `fut.get()` blocks until ready and returns the result — but only once (a second `.get()` throws `std::future_error`).",
      section: 30
    },
    {
      type: "fill",
      q: "Which C++17 lock locks multiple mutexes together with a deadlock-avoiding algorithm?",
      accept: ["std::scoped_lock", "scoped_lock"],
      answerDisplay: "`std::scoped_lock`",
      explain: "`std::scoped_lock(m1, m2, ...)` acquires several mutexes atomically using a deadlock-avoidance algorithm, so two threads requesting them in opposite orders won't deadlock.",
      section: 30
    }
  ]
};
