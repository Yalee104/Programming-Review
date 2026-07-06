# C++ Syntax & Techniques — Study Summary

## 1. Implicit vs Explicit Conversion

```cpp
// implicit — compiler auto converts int → Widget silently
void process(Widget w) {}
process(42);              // compiler calls Widget(42) for you

// explicit — blocks implicit conversion, must convert manually
explicit Widget(int id) {}
process(42);              // error: blocked
process(Widget(42));      // ok: must be explicit
```

---

## 2. Qualifiers After Function Signature

```cpp
virtual void describe() const override = 0;
// virtual   — can be overridden by subclass
// const     — method won't modify object members
// override  — verifies base class has matching virtual
// = 0       — pure virtual, subclass must implement
```

Order is fixed: `const` must come before `override`.
```cpp
void f() override const { }   // error: wrong order
void f() const override { }   // ok
```

---

## 3. Struct vs Class

```cpp
struct Foo { int x; };    // x is public by default
class  Bar { int x; };    // x is private by default
// everything else identical — constructors, methods, inheritance, virtual
```

---

## 4. Access Modifiers

```cpp
class Base {
public:    int a;   // everyone — class, subclass, outside
protected: int b;   // class and subclasses only
private:   int c;   // class only
};
```

**Important nuance: `private` is per-CLASS, not per-OBJECT.** Any instance of a class can
freely access the `private` members of ANOTHER instance of that SAME class — "class only"
means "code belonging to this class," not "only this specific object."

```cpp
class Account {
public:
    Account(double balance) : balance_(balance) {}

    bool hasMoreThan(const Account& other) const {
        return balance_ > other.balance_;   // reading ANOTHER object's private member directly
    }
    void transferTo(Account& other, double amount) {
        balance_ -= amount;          // this object's own private member
        other.balance_ += amount;    // another object's private member -- still OK, same class
    }
    double balance() const { return balance_; }

private:
    double balance_;   // private -- visible to ALL Account instances, not just "this" one
};
```
Usage (verified):
```cpp
Account a(100), b(50);
a.hasMoreThan(b);      // true  -- accessed b's private balance_ directly from inside Account code
a.transferTo(b, 30);
a.balance();             // 70
b.balance();             // 80
```
From OUTSIDE the class, `private` is still fully blocked, regardless of which object:
```cpp
Account a(100), b(50);
a.balance_ > b.balance_;   // error: 'double Account::balance_' is private within this context
                             // -- verified, fails for BOTH a and b, not just a foreign object
```

---

## 5. lvalue vs rvalue

```cpp
int x = 5;      // x is lvalue  — has name, has address, persists
5;              // rvalue — temporary, no name, no address

&x;             // ok: can take address — lvalue
&5;             // error: cannot take address — rvalue

int&  a = x;   // lvalue ref  — binds lvalue only
int&& b = 5;   // rvalue ref  — binds rvalue only
```

---

## 6. auto&& Universal Reference

```cpp
// binds to anything — lvalue or rvalue
auto&& a = x;            // x is lvalue  → a becomes int&
auto&& b = 5;            // rvalue       → b becomes int&&
auto&& c = make_thing(); // rvalue       → lifetime extended

// most common use — range for loop
for (auto&& item : collection) { }   // safest, handles all cases

// && meaning depends on context:
Widget&&   w = ...;   // concrete type — rvalue ref only
auto&&     w = ...;   // universal ref — binds anything
T&&        w = ...;   // template      — universal ref
```

---

## 7. std::move

```cpp
// std::move is just a cast — moves nothing
// internally: static_cast<T&&>(x)

int&& c = 5;        // c has a name → c is lvalue inside scope
std::move(c);       // casts c back to rvalue — strips the name

// actual moving done by move constructor/assignment:
std::vector<int> a = {1,2,3};
std::vector<int> b = std::move(a);  // move() just opens the door
                                     // vector move ctor does the stealing
std::cout << a.size();   // 0 — move ctor emptied a
```

---

## 8. Rule of 0, 3, 5

```cpp
// 5 special member functions:
~Widget();                              // destructor
Widget(const Widget&);                  // copy constructor
Widget& operator=(const Widget&);       // copy assignment
Widget(Widget&&) noexcept;              // move constructor
Widget& operator=(Widget&&) noexcept;   // move assignment

// Rule of 0 — own no raw resources, define none — most common
struct Point { float x, y; };          // compiler handles everything

// Rule of 3 — owns raw resource, define destructor+copy ctor+copy assign
// Rule of 5 — Rule of 3 + move ctor + move assign

// modern advice — prefer Rule of 0:
std::unique_ptr<int[]> data_;          // smart pointer — no manual cleanup
```

---

## 9. Initializer List vs Body Assignment

```cpp
// initializer list — members initialized directly
Buffer(int size) : data_(new int[size]), size_(size) {}

// body assignment — default init first, then overwrite (two steps)
Buffer(int size) { data_ = new int[size]; size_ = size; }

// initializer list REQUIRED for:
const int id_;        // const members
int& ref_;            // references
Bar member_;          // no default constructor
```

---

## 10. Move Constructor vs Move Assignment

```cpp
Widget a(42);
Widget b = std::move(a);   // move constructor   — b is NEW object
Widget c(99);
c = std::move(a);          // move assignment    — c ALREADY EXISTS

// noexcept — required for STL containers to use move instead of copy
Widget(Widget&&) noexcept = default;
```

---

## 11. STL vs Standard Library

```
C++ Standard Library
├── STL (original Stepanov library, adopted into standard)
│   ├── Containers   — vector, map, set, list ...
│   ├── Algorithms   — sort, find, accumulate, transform ...
│   └── Iterators    — begin, end, reverse_iterator ...
│
└── Non-STL standard components
    ├── I/O          — iostream, cin, cout
    ├── Strings      — std::string
    ├── Memory       — unique_ptr, shared_ptr
    ├── Threading    — std::thread, std::mutex
    ├── Time         — std::chrono
    └── Filesystem   — std::filesystem

// sort, accumulate = STL algorithms, also part of standard library
// "STL" used loosely in practice to mean entire standard library
```

---

## 12. STL Containers

```cpp
std::vector<int>               // dynamic array — default choice
std::array<int, 3>             // fixed size array
std::deque<int>                // fast insert front and back
std::list<int>                 // fast insert anywhere, no index
std::map<string, int>          // key→value, sorted, O(log n)
std::unordered_map<string,int> // key→value, hash, O(1)
std::set<int>                  // unique values, sorted
std::stack<int>                // LIFO
std::queue<int>                // FIFO
std::priority_queue<int>       // largest element always on top
```

---

## 13. Templates

```cpp
template <typename T>
T max_of(T a, T b) { return a > b ? a : b; }

max_of(3, 5);           // T=int   — implicit deduction
max_of<double>(3, 5);   // T=double — explicit

// multiple type parameters
template <typename T, typename U>
auto max_of(T a, U b) { return a > b ? a : b; }

max_of(3, 5.0);              // T=int, U=double — implicit
max_of<int, double>(3, 5.0); // explicit — left to right only
max_of<double>(3, 5.0);      // T=double explicit, U=double deduced
```

---

## 14. Structured Bindings

```cpp
struct P { int x, y, z; };

auto [a, b, c] = P{1, 2, 3};    // ok: must match exactly
auto [a, b]    = P{1, 2, 3};    // error: count must match

auto  [a, b, c] = p;    // copy
auto& [a, b, c] = p;    // reference — changes affect original
auto&&[a, b, c] = p;    // universal ref

// most common use — map iteration
for (const auto& [key, value] : mymap) { }

// unused members — by convention
auto [a, _, c] = P{1, 2, 3};    // _ signals intentionally unused
```

---

## 15. std::accumulate

```cpp
#include <numeric>

std::accumulate(v.begin(), v.end(), init);          // sum
std::accumulate(v.begin(), v.end(), init, op);      // custom operation

// custom operator signature:
[](AccType acc, ElemType current) { return new_acc; }
//  matches init  matches vector element type

// init type determines return type:
std::accumulate(v.begin(), v.end(), 0);     // returns int
std::accumulate(v.begin(), v.end(), 0.0);   // returns double

// with vector of pointers:
std::accumulate(shapes.begin(), shapes.end(), 0.0,
    [](double acc, const std::unique_ptr<Shape>& s) {
        return acc + s->area();   // & required — unique_ptr not copyable
    }
);
```

---

## 16. Inheritance

```cpp
class Derived : public    Base {}   // is-a, full interface exposed
class Derived : protected Base {}   // hides from outside, passes to grandchildren
class Derived : private   Base {}   // hides from outside AND grandchildren

// access after inheritance:
//                        public    protected   private
// Base public member  →  public    protected   private
// Base protected      →  protected protected   private
// Base private        →  hidden    hidden      hidden

// constructor — must explicitly call base:
Circle(double r) : Shape("circle"), radius_(r) {}

// virtual inheritance — fixes diamond problem:
class Bird : virtual public Animal {};
class Fish : virtual public Animal {};
class Platypus : public Bird, public Fish {};  // one Animal only
```

---

## 17. Virtual Destructor

```cpp
// WITHOUT virtual destructor — memory leak
class Animal {
public:
    ~Animal() {}             // not virtual
};
class Dog : public Animal {
    std::string name_;       // never cleaned up
};
Animal* a = new Dog();
delete a;                    // error: only ~Animal() called — ~Dog() skipped

// WITH virtual destructor — correct
class Animal {
public:
    virtual ~Animal() {}     // virtual — one declaration on base is enough
};
class Dog : public Animal {
    ~Dog() override {}       // implicitly virtual — override for clarity
};
Animal* a = new Dog();
delete a;                    // ok: ~Dog() → ~Animal() — correct order

// when virtual destructor is needed:
// needed:     base class used with base pointer/reference
// needed:     abstract class or interface
// not needed: class never used as base
// not needed: type always known, never used polymorphically

// performance note:
class Foo { int x; };                    // sizeof = 4
class Bar { int x; virtual ~Bar(){}; };  // sizeof = 16 — vtable ptr added
```

---

## 18. Explicit Destructor vs Compiler Generated

```cpp
// Rule — only declare destructor if you own raw resources
class Circle : public Shape {
    // no destructor needed:
    double r_;           // plain double — nothing to clean up
    std::string name_;   // cleans itself up
};

// destructor needed:
class Circle : public Shape {
public:
    ~Circle() override {
        delete[] points_;   // raw pointer — must clean up manually
    }
private:
    int* points_;           // owns raw resource
};
```

---

## 19. Virtual Destructor Inheritance Chain

```cpp
// virtual propagates automatically — only declare once on base
class Shape {
public:
    virtual ~Shape() = default;   // virtual declared here ONCE
};

class Circle : public Shape {
public:
    ~Circle() override {}         // implicitly virtual — override for clarity
};

class FilledCircle : public Circle {
public:
    ~FilledCircle() override {}   // implicitly virtual — override for clarity
};

Shape* s = new FilledCircle();
delete s;
// correct chain bottom up:
// ~FilledCircle() → ~Circle() → ~Shape()

// key rules:
// virtual on base destructor   → propagates down automatically forever
// explicit destructor          → only if owning raw resources
// override on derived          → not required but recommended for clarity
```

---

## 20. Smart Pointers — unique_ptr, shared_ptr, weak_ptr

Sections 17–19 showed the classic problem: `Animal* a = new Dog(); delete a;` requires you to
remember `delete`, gets it wrong easily, and needs a virtual destructor to even work correctly
for polymorphic types. Smart pointers are the standard-library fix — they own a resource and
free it automatically when they go out of scope, so manual `delete` is (almost) never needed.

**`std::unique_ptr<T>` — exclusive ownership, move-only, zero overhead**

```cpp
class Animal {
public:
    virtual void speak() const { std::cout << "Animal speaks\n"; }
    virtual ~Animal() { std::cout << "~Animal\n"; }
};
class Dog : public Animal {
public:
    void speak() const override { std::cout << "Dog barks\n"; }
    ~Dog() override { std::cout << "~Dog\n"; }
};
```
```cpp
{
    std::unique_ptr<Animal> a = std::make_unique<Dog>();   // prefer make_unique over raw 'new'
    a->speak();                                                // Dog barks -- still virtual dispatch
}   // scope ends -> ~Dog() then ~Animal() automatically, NO manual delete -- verified
```

`unique_ptr` cannot be copied — only moved. This is enforced at compile time:
```cpp
std::unique_ptr<Dog> p1 = std::make_unique<Dog>();
std::unique_ptr<Dog> p2 = std::move(p1);   // ownership TRANSFERRED, not duplicated
p1 == nullptr;    // true  -- p1 gave up ownership
p2 != nullptr;     // true  -- p2 is the sole owner now

std::unique_ptr<Dog> b = p2;   // error: use of deleted function 'unique_ptr(const unique_ptr&)' -- verified
```

Other core operations:
```cpp
Dog* raw = p2.get();   // OBSERVE the pointer without transferring ownership (don't delete raw!)
p2.reset();              // destroys the owned object right now, p2 becomes null -- verified

std::unique_ptr<int[]> arr = std::make_unique<int[]>(3);   // array form -- calls delete[] automatically
arr[0] = 10; arr[1] = 20;
arr[1];   // 20 -- verified
```

**`std::shared_ptr<T>` — reference-counted SHARED ownership**

Multiple `shared_ptr`s can own the same object; it's destroyed only when the LAST owner goes away.

```cpp
std::shared_ptr<Widget> s1 = std::make_shared<Widget>(1);
s1.use_count();     // 1

{
    std::shared_ptr<Widget> s2 = s1;   // COPY allowed (unlike unique_ptr) -- refcount++
    s1.use_count();                       // 2 -- verified
    s2->id_ = 99;                           // both s1 and s2 see the same object
}   // s2 destroyed -> refcount--, object survives (s1 still owns it)
s1.use_count();   // back to 1 -- verified
```

**`std::weak_ptr<T>` — a non-owning observer of a shared_ptr's object**

Doesn't affect the reference count. Must call `.lock()` to get a temporary usable `shared_ptr`
(which returns an empty one if the object is already gone) — this is what makes it safe.

```cpp
std::weak_ptr<Widget> w = s1;        // does NOT increase use_count
s1.use_count();                        // still 1  -- verified
w.expired();                             // false -- object still alive

if (auto locked = w.lock()) { locked->id_; }   // safe temporary access

s1.reset();               // drop the only real owner -> Widget is destroyed
w.expired();                // true now -- verified
w.lock();                     // returns an empty/null shared_ptr -- verified, no crash
```

**Why `weak_ptr` matters: breaking reference cycles**

Two objects holding `shared_ptr`s to EACH OTHER never reach a reference count of 0 — classic
memory leak. Using `weak_ptr` for the "back" reference breaks the cycle:

```cpp
struct NodeLeaky {
    std::shared_ptr<NodeLeaky> next;
    std::shared_ptr<NodeLeaky> prev;   // BOTH shared_ptr -> cycle
};
struct NodeFixed {
    std::shared_ptr<NodeFixed> next;   // owns forward
    std::weak_ptr<NodeFixed>   prev;   // does NOT own backward -- no cycle
};
```
Verified side-by-side: with `NodeLeaky`, `a->next = b; b->prev = a;` inside a scope block leaves
NO destructor calls printed once the scope ends — the objects leak, still holding each other
alive. With `NodeFixed`, the same pattern prints `~NodeFixed(A)` then `~NodeFixed(B)` correctly
once the scope ends, because `prev` being a `weak_ptr` never contributed to the refcount.

Quick reference:
```
unique_ptr<T>   → exclusive ownership, move-only, no refcounting, essentially free (just a raw ptr)
shared_ptr<T>   → shared ownership via atomic refcount; destroyed when last owner drops it
weak_ptr<T>     → non-owning observer of a shared_ptr; doesn't affect lifetime;
                  .lock() -> temporary shared_ptr (empty if object already gone)
                  .expired() -> bool check without locking

make_unique<T>(args...)  → prefer over 'new T(args...)' -- exception-safe, less typing
make_shared<T>(args...)  → prefer over 'new T(args...)' -- ALSO allocates control block
                            in the SAME allocation as the object (one alloc instead of two)

.get()      → observe raw pointer without giving up ownership (never delete it yourself)
.release()  → unique_ptr ONLY -- gives up ownership, returns raw pointer, caller must delete
.reset()    → destroy the currently owned object now, become empty/null

copying:
  unique_ptr  → NOT copyable, compile error -- only std::move()
  shared_ptr  → copyable -- copy = share ownership, refcount++

classic use → replaces 'Base* p = new Derived(); delete p;' from sections 17-19 entirely;
              combined with a virtual destructor, polymorphic cleanup is fully automatic

cycles      → shared_ptr <-> shared_ptr = leak (refcount never hits 0)
              fix: make one direction (e.g. child->parent "back" link) a weak_ptr instead
```

---

## 21. Mixing Raw Resources and STL Containers in a Class

Once you write ANY custom copy/move constructor or assignment, the compiler
stops auto-generating that function — you must handle EVERY member yourself,
including STL containers (not just the raw resource).

```cpp
class Widget {
public:
    Widget(int size) : data_(new int[size]), size_(size) {}
    ~Widget() { delete[] data_; }

    // copy constructor — must handle BOTH raw pointer and STL container
    Widget(const Widget& other)
        : data_(new int[other.size_])
        , size_(other.size_)
        , items_(other.items_)        // STL container copied via its own copy ctor
    {
        std::copy(other.data_, other.data_ + size_, data_);
    }

    // copy assignment
    Widget& operator=(const Widget& other) {
        if (this == &other) return *this;
        delete[] data_;
        data_ = new int[other.size_];
        size_ = other.size_;
        std::copy(other.data_, other.data_ + size_, data_);
        items_ = other.items_;        // vector handles its own assignment
        return *this;
    }

    // move constructor — use std::move on STL member too
    Widget(Widget&& other) noexcept
        : data_(other.data_)
        , size_(other.size_)
        , items_(std::move(other.items_))   // move, not copy
    {
        other.data_ = nullptr;
        other.size_ = 0;
        // items_ already left in valid empty state by vector's move ctor
    }

    // move assignment
    Widget& operator=(Widget&& other) noexcept {
        if (this == &other) return *this;
        delete[] data_;
        data_ = other.data_;
        size_ = other.size_;
        other.data_ = nullptr;
        other.size_ = 0;
        items_ = std::move(other.items_);   // move, not copy
        return *this;
    }

private:
    int* data_;
    int size_;
    std::vector<std::string> items_;
};
```

Common mistake — forgetting the STL member compiles fine but silently breaks:
```cpp
// forgot items_ in initializer list → default-constructed empty, not copied
Widget(const Widget& other)
    : data_(new int[other.size_]), size_(other.size_) {
    std::copy(other.data_, other.data_ + size_, data_);
    // items_ silently empty — no error, no warning
}

// forgot std::move on STL member in move ctor → accidentally COPIES instead
Widget(Widget&& other) noexcept
    : data_(other.data_), size_(other.size_), items_(other.items_) {
    // items_(other.items_) without std::move = copy, defeats the point of move
}
```

Best practice — avoid raw resources entirely when possible:
```cpp
// instead of raw pointer requiring manual Rule of 5:
class Widget {
    int* data_;
    std::vector<std::string> items_;
};

// wrap raw resource in STL container/smart pointer → Rule of 0 applies:
class Widget {
    std::vector<int> data_;              // replaces raw pointer
    std::vector<std::string> items_;
    // compiler generates correct copy/move for ALL members automatically
};
```

---

## 22. const — Standard Types, Pointers, References, Classes, Typedef, auto

```cpp
// ---- 1. standard types ----
const int a = 10;
// a = 20;                  // error: read-only

// ---- 2. pointers — read right-to-left ----
const int* p1 = &x;         // pointer to const int — data locked, pointer free
// *p1 = 5;                  // error
p1 = &y;                     // ok: can repoint

int* const p2 = &x;         // const pointer to int — pointer locked, data free
*p2 = 5;                      // ok
// p2 = &y;                   // error: can't repoint

const int* const p3 = &x;   // const pointer to const int — both locked

// "const int* p"  → p is a pointer to a const int   ("low-level const")
// "int* const p"  → p is a const pointer to an int  ("top-level const")

// ---- 3. references ----
const int& ref = x;         // reference to const — can't modify THROUGH ref
// ref = 99;                 // error
x = 99;                       // still fine directly; ref reflects x's real value
// const references can also bind temporaries (rvalues) — key reason
// "const T&" is the standard way to pass read-only args cheaply:
void f(const std::string& s);   // no copy, can't modify caller's string

// ---- 4. classes ----
class Widget {
public:
    int getValue() const {          // const method — can't modify members
        return value_;
    }
    void setValue(int v) { value_ = v; }   // non-const — free to modify

    void touch() const {
        cache_hits_++;               // mutable bypasses const — OK
    }
private:
    int value_;
    mutable int cache_hits_ = 0;     // modifiable even on const objects
};

const Widget cw(42);
cw.getValue();      // ok — const method
// cw.setValue(10);  // error — non-const method on const object
// rule: const object can only call const member functions

// ---- 5. typedef / using ----
typedef const int CInt;        // CInt == const int always
using  CIntAlias = const int;  // same, modern syntax

typedef char* PChar;
// const substitutes BEFORE the typedef expands — common trap:
const PChar cstr = str;   // means "char* const" (const POINTER, not const chars)
cstr[0] = 'H';              // ok — chars still mutable
// cstr = other;             // error — pointer itself is const

// ---- 6. auto ----
const int ci = 100;
auto  a1 = ci;        // auto STRIPS top-level const → a1 is plain int (copy)
a1 = 200;               // ok — a1 is NOT const

const auto a2 = ci;   // re-add const explicitly → a2 is const int
// a2 = 300;            // error

auto&       a3 = ci;   // auto& does NOT strip const → a3 is const int&
// a3 = 400;             // error

const auto& a4 = x;    // const auto& — safest generic read-only binding,
                         // works with lvalues, rvalues, and const sources
```

Key takeaways:
```
const on the LEFT of *   → data pointed to is const   (low-level)
const on the RIGHT of *  → pointer itself is const     (top-level)
const T&                 → cheap read-only param, binds temporaries too
const member function    → promises not to modify non-mutable members
mutable                  → escape hatch, modifiable even in const methods
const object              → can only call const member functions
typedef + const           → const applies to the ALIAS AS A WHOLE,
                             not re-parsed into the underlying type
                             (typedef char* PChar; const PChar → char* const)
auto                       → strips top-level const/reference, copies
auto&                      → preserves const-ness of source
const auto&                → universal safe read-only binding
```

---

## 23. Follow-up: const Pointee via typedef, and const auto / auto& Clarified

**Making the typedef's POINTEE const (not the pointer)**

`const PChar` always locks the *pointer*, never reaches inside to the pointee — typedef is opaque, `const` can't "see through" it. To lock the pointee, bake `const` into the alias's own definition, before the pointer is formed:

```cpp
typedef char* PChar;             // PChar = "char*"
// const PChar p;                 // locks the POINTER (char* const) — not what we want

typedef const char* PConstChar;  // const baked in HERE → PConstChar = "const char*"
char buf[] = "hello";
PConstChar pc = buf;
pc[0] = 'H';                       // ERROR: assignment of read-only location — pointee locked
pc = buf;                           // OK: pointer itself still reassignable

const PConstChar pcc = buf;      // combine both: const pointer to const char
```

**`const auto a2 = ci;` — what you CAN and CANNOT do**

`a2` is a plain, independent **copy** of `ci`, typed `const int`. It is not a reference to anything.

```cpp
const int ci = 100;
const auto a2 = ci;      // a2 is its own const int, holding a copy of ci's value

std::cout << a2;          // OK: read it
int x = a2;                // OK: copy its value into a normal mutable variable
a2 = 200;                   // ERROR: assignment of read-only variable 'a2'
int* p = &a2;               // ERROR: can't get non-const pointer to a const object
const int* p2 = &a2;        // OK: const pointer to const int matches
```

**`auto& a3 = ci;` — why this is `const int&`, not modifiable**

This is the part that trips people up: `auto&` does not *grant* mutability — it just **preserves whatever const-ness the source already had**, the same way template argument deduction works for `T&`. The `&` only says "make a reference, don't copy"; it says nothing about const. Compare the same line applied to a const vs. non-const source:

```cpp
int x = 1;
const int y = 2;

auto& refA = x;    // x is non-const int → deduces T=int      → refA is int&        (modifiable)
refA = 111;          // OK — really modifies x

auto& refB = y;    // y is const int     → deduces T=const int → refB is const int&  (read-only)
refB = 222;          // ERROR: assignment of read-only reference 'refB'
```

Same syntax, opposite result — it depends entirely on the const-ness of what's on the right-hand side. Rule of thumb: `auto` (no `&`) always strips top-level const because it copies; `auto&` and `auto&&` never strip const because they bind to the original object and must respect its constness (a non-const reference cannot legally alias a const object).

To force a mutable reference to something declared const anyway, you'd need `const_cast` — but modifying an object that was originally declared `const` through a cast is undefined behavior, so this is only safe if the underlying object isn't actually const (e.g., a const-ref parameter aliasing a non-const caller variable).

```cpp
auto& refC = const_cast<int&>(y);   // compiles, but UB to then write through it if y is truly const
```

Quick reference:
```
const PChar (typedef char* PChar)   → locks the pointer, NOT the pointee
typedef const char* PConstChar      → const baked in first → locks the pointee instead

const auto a2 = ci   → a2 is an independent CONST COPY — can read, cannot reassign
auto& a3  = ci        → reference PRESERVES source const-ness — const in, const out
auto& a3  = x (non-const) → reference is mutable — modifies x for real

auto   → always copies, strips top-level const
auto&  → never copies, never strips const — mirrors the source
```

---

## 24. Operator Overloading

```cpp
// ---- 1. arithmetic — member (left operand is *this, implicit) ----
class Vec2 {
public:
    Vec2(double x, double y) : x_(x), y_(y) {}

    Vec2 operator+(const Vec2& other) const {         // a + b  =>  a.operator+(b)
        return Vec2(x_ + other.x_, y_ + other.y_);
    }
    Vec2& operator+=(const Vec2& other) {              // modifies *this, returns ref (chainable)
        x_ += other.x_; y_ += other.y_;
        return *this;
    }
    Vec2 operator-() const { return Vec2(-x_, -y_); }  // unary minus
    bool operator==(const Vec2& other) const {          // comparison
        return x_ == other.x_ && y_ == other.y_;
    }
    double x() const { return x_; }
    double y() const { return y_; }
private:
    double x_, y_;
};

// ---- 2. stream insertion — MUST be non-member ----
// left operand is std::ostream, not Vec2 — can't add a member fn to ostream
std::ostream& operator<<(std::ostream& os, const Vec2& v) {
    return os << "(" << v.x() << ", " << v.y() << ")";   // return stream => chainable: cout<<a<<b
}

// usage + verified output for sections 1 & 2:
Vec2 a(1, 2), b(3, 4);
Vec2 c = a + b;                 std::cout << c;            // (4, 6)      -- operator+
a += b;                          std::cout << a;            // (4, 6)      -- operator+=
Vec2 neg = -a;                   std::cout << neg;          // (-4, -6)    -- unary operator-
std::cout << (a == b);                                       // 0 (false)  -- operator==

// ---- 3. subscript [] — provide both const and non-const overloads ----
class IntArray {
public:
    IntArray(int size) : data_(new int[size]), size_(size) {}
    ~IntArray() { delete[] data_; }
    int&       operator[](int i)       { return data_[i]; }  // read/write
    const int& operator[](int i) const { return data_[i]; }  // read-only, for const objects
private:
    int* data_; int size_;
};
// usage + verified output:
IntArray arr(3);
arr[0] = 10; arr[1] = 20; arr[2] = 30;   // uses non-const operator[] to WRITE
std::cout << arr[1];                      // 20 -- uses operator[] to READ

// ---- 4. function call () — makes an object "callable" (functor) ----
class Multiplier {
public:
    Multiplier(int factor) : factor_(factor) {}
    int operator()(int x) const { return x * factor_; }
private:
    int factor_;
};
// usage + verified output:
Multiplier times3(3);
std::cout << times3(7);   // 21 -- times3(7) is really times3.operator()(7)

// ---- 5. arrow -> and dereference * — used by smart pointers / iterators ----
class SimplePtr {
public:
    SimplePtr(Vec2* p) : p_(p) {}
    Vec2* operator->() const { return p_; }   // sp->x()  =>  (sp.operator->())->x()
    Vec2& operator*()  const { return *p_; }  // *sp
private:
    Vec2* p_;
};
// usage + verified output:
Vec2 point(5, 6);
SimplePtr sp(&point);
std::cout << sp->x();     // 5 -- sp->x() calls operator->() then .x() on the result
std::cout << (*sp).y();   // 6 -- *sp calls operator*(), then .y() on the returned Vec2&

// ---- 6. increment/decrement — prefix vs postfix ----
class Counter {
public:
    Counter(int v) : v_(v) {}
    Counter& operator++() {          // prefix ++c  — no dummy param, returns NEW value by ref
        ++v_; return *this;
    }
    Counter operator++(int) {        // postfix c++ — dummy 'int' marks postfix, returns OLD by copy
        Counter old = *this; ++v_; return old;
    }
    int value() const { return v_; }
private:
    int v_;
};
// usage + verified output:
Counter cnt(5);
Counter afterPre  = ++cnt;    // prefix: increments FIRST (cnt=6), returns the NEW value  -> 6
Counter afterPost = cnt++;    // postfix: returns OLD value (6) THEN increments (cnt=7)   -> 6
std::cout << cnt.value();       // 7  -- cnt was incremented twice total
std::cout << afterPre.value();  // 6
std::cout << afterPost.value(); // 6  -- captured the value BEFORE the second increment

// ---- 7. C++20 spaceship <=> — auto-generates <,<=,>,>=,==,!= at once ----
class Score {
public:
    Score(int v) : v_(v) {}
    auto operator<=>(const Score&) const = default;
    int v_;
};
// usage + verified output:
Score s1(90), s2(85);
std::cout << (s1 > s2);    // 1 (true)  -- derived automatically from <=>
std::cout << (s1 == s2);   // 0 (false) -- derived automatically from <=>

// ---- 8. non-member operator needed when left operand isn't your class ----
class Vec2b {
public:
    Vec2b(double x, double y) : x_(x), y_(y) {}
    Vec2b operator*(double s) const { return Vec2b(x_ * s, y_ * s); }   // vec * scalar (member ok)

    // scalar * vec — left operand is double, can't add a member fn to double,
    // so this MUST be non-member; friend grants access to private x_, y_
    friend Vec2b operator*(double s, const Vec2b& v);
    friend std::ostream& operator<<(std::ostream& os, const Vec2b& v);
private:
    double x_, y_;
};
Vec2b operator*(double s, const Vec2b& v) { return Vec2b(s * v.x_, s * v.y_); }
std::ostream& operator<<(std::ostream& os, const Vec2b& v) { return os << "(" << v.x_ << ", " << v.y_ << ")"; }
// usage + verified output:
Vec2b v(1, 2);
std::cout << (v * 3);   // (3, 6) -- member: v.operator*(3)
std::cout << (3 * v);   // (3, 6) -- non-member friend: operator*(3, v) -- SAME result, different path
```

Rules and guidelines:
```
member vs non-member:
  member       → when *this is naturally the LEFT operand (a + b, a[i], a(), a->)
  non-member   → when left operand is NOT your class (ostream<<, scalar*vec)
                 or you want symmetric behavior (a+b same as b+a with mixed types)
  friend       → grants a non-member function access to private members

must be members (language rule): operator=, operator[], operator(), operator->,
                                  conversion operators, and (T) cast operator

prefix ++/--   → no parameter,     returns reference to *this (new value)
postfix ++/--  → dummy int param,  returns a copy of the OLD value

cannot overload: ::  .  .*  ?:  sizeof   (fixed language operators)
cannot: invent new operator tokens, change arity, or change precedence
can:    change what an existing operator DOES for your own types only
        (at least one operand must be a user-defined type)

operator<=> (C++20) → "= default" auto-derives all 6 comparisons from
                       member-wise comparison, replacing 6 hand-written operators
```

---

## 25. Operator Fundamentals: Is Arity Customizable? How Does Chaining Work?

**Arity (number of operands) is fixed by the operator itself — you cannot change it.** Binary operators (`+`, `-`, `==`...) always take exactly 2 operands; unary operators (`-`, `!`, `++`...) always take exactly 1. What you CAN choose is member vs. non-member, which changes how many EXPLICIT parameters you write — because a member function's `*this` silently fills the left operand.

```cpp
class Vec2 {
public:
    Vec2(double x=0, double y=0) : x_(x), y_(y) {}

    // BINARY as member — *this fills LEFT slot → only 1 explicit param
    Vec2 operator+(const Vec2& rhs) const { return Vec2(x_+rhs.x_, y_+rhs.y_); }

    // UNARY as member — *this is the only operand → 0 explicit params
    Vec2 operator-() const { return Vec2(-x_, -y_); }

    double x() const { return x_; } double y() const { return y_; }
private:
    double x_, y_;
};

// BINARY as non-member — no *this, so BOTH operands must be explicit
Vec2 operatorPlusFree(const Vec2& lhs, const Vec2& rhs) {
    return Vec2(lhs.x()+rhs.x(), lhs.y()+rhs.y());
}
```

Usage (verified):
```cpp
Vec2 a(1,1), b(2,2);
a + b;              // (3, 3)  == a.operator+(b)
a.operator+(b);      // (3, 3)  -- explicit call form, same thing
-a;                  // (-1, -1) == a.operator-()
```

Trying to add extra parameters to a binary member operator fails to compile:
```cpp
Vec2 operator+(const Vec2& rhs, int extra) const { ... }
// error: 'Vec2::operator+(const Vec2&, int)' must have either zero or one argument
```

**The one exception: `operator()`.** Function-call syntax has no fixed arity — you can overload it with as many parameters as you like, including zero. This is what makes functors flexible:

```cpp
class Adder {
public:
    int operator()() const { return 0; }
    int operator()(int a) const { return a; }
    int operator()(int a, int b) const { return a + b; }
    int operator()(int a, int b, int c) const { return a + b + c; }
};
Adder add;
add();          // 0
add(5);          // 5
add(5, 6);        // 11
add(5, 6, 7);      // 18
```

**Chaining `a + b + c`** relies on two ordinary facts, not special syntax: `+` is left-associative (parses as `(a + b) + c`), and `operator+` returns a brand-new object **by value**, which becomes the left operand feeding into the next `+`.

```cpp
Vec2 a(1,1), b(2,2), c(3,3);
Vec2 d = a + b + c;         // (6, 6)

// equivalent step-by-step, proving the associativity:
Vec2 step1 = a + b;          // (3, 3)
Vec2 step2 = step1 + c;      // (6, 6)  -- identical result
```

If `operator+` returned `void` or modified `*this` in place instead of returning a new object, `a + b + c` simply wouldn't compile — chaining falls directly out of the return type, nothing more.

> Note: `Vec2 d = a + b + d;` (reusing `d` on the right while declaring it on the left) is undefined behavior — `d` doesn't exist yet at that point. Always chain into a *different*, already-initialized variable.

Quick reference:
```
arity is fixed by the operator            → cannot add/remove operands
member operator     → *this = left operand → write (arity - 1) explicit params
non-member operator → no *this            → write ALL operands explicitly
operator()           → ONLY exception — arity is entirely up to you (0..N params)
chaining (a+b+c)      → works because operator+ returns a NEW object by value;
                        relies on normal left-to-right associativity, no magic
```

---

## 26. Polymorphism & vtables — How Virtual Dispatch Actually Works

**The model:** every class with at least one `virtual` function gets a compiler-generated **vtable** (virtual table) — a static array of function pointers, ONE PER CLASS (not per object). Every instance of a polymorphic class carries one hidden extra member, a **vptr** (vtable pointer), set by the constructor to point at its class's vtable. A call like `a->speak()` doesn't jump to code directly — it reads `a`'s vptr, indexes into the vtable at `speak`'s fixed slot, and jumps through that function pointer. That indirection is the entire mechanism.

**1. Basic dispatch — base pointer calls the DERIVED override**
```cpp
class Animal {
public:
    virtual void speak() const { std::cout << "Animal speaks\n"; }
    virtual void move()  const { std::cout << "Animal moves\n"; }
    void category()      const { std::cout << "Animal category\n"; }  // NOT virtual
    virtual ~Animal() = default;
};
class Dog : public Animal {
public:
    void speak() const override { std::cout << "Dog barks\n"; }
    // move() not overridden -> inherits Animal::move
    void category() const { std::cout << "Dog category\n"; }   // HIDES, does not override (no virtual)
};
class Cat : public Animal {
public:
    void speak() const override { std::cout << "Cat meows\n"; }
    void move()  const override { std::cout << "Cat prowls\n"; }
};
```
Usage (verified):
```cpp
Animal* animals[] = { new Dog(), new Cat() };
for (auto* a : animals) { a->speak(); a->move(); }
// Dog barks
// Animal moves     <- Dog didn't override move(), inherits Animal's vtable slot
// Cat meows
// Cat prowls
```

**2. Static (compile-time) vs dynamic (runtime) dispatch — the `virtual` keyword is what flips it**
```cpp
Animal* a = new Dog();
a->speak();       // Dog barks       -- dynamic: resolved via vptr, uses ACTUAL object type
a->category();     // Animal category -- static:  resolved at compile time from POINTER's type
```
This is the single most common polymorphism bug: forgetting `virtual` means the base class's declared type — not the real object — decides which function runs.

**3. vptr has a real memory cost**
```cpp
struct NoVirtual   { int x; };
struct WithVirtual { int x; virtual void f() {} };
sizeof(NoVirtual);     // 4  -- just the int
sizeof(WithVirtual);   // 16 -- 8-byte vptr + 4-byte int + 4 padding (64-bit)
```

**4. Slicing destroys polymorphism — it only works through pointers/references**
```cpp
Dog dog;
Animal sliced = dog;   // COPY into a plain Animal object
sliced.speak();          // "Animal speaks" -- Dog-ness is gone; the copy's vptr
                           // was set to Animal's vtable by Animal's own copy ctor
```
Polymorphism requires indirection (`Animal*` or `Animal&`) so the vptr travels with the real object. By-value copies into a base type always get the base's own vtable.

**5. Proof the vtable is just memory — reading it directly**

(Educational only — relies on the Itanium C++ ABI used by GCC/Clang on Linux, not standard-portable, never do this in real code.)
```cpp
Dog d1, d2;
Cat c1;

// every polymorphic object's first hidden field IS the vptr:
void** vptr_d1 = *reinterpret_cast<void***>(&d1);
void** vptr_d2 = *reinterpret_cast<void***>(&d2);
void** vptr_c1 = *reinterpret_cast<void***>(&c1);

vptr_d1 == vptr_d2;   // true  -- same class -> SAME vtable address (shared, not per-object)
vptr_d1 == vptr_c1;   // false -- different class -> different vtable

// slot 0 holds the address of the most-derived speak() -- call it directly:
using SpeakFn = void(*)(const void*);
reinterpret_cast<SpeakFn>(vptr_d1[0])(&d1);   // prints "Dog barks"  -- verified
reinterpret_cast<SpeakFn>(vptr_c1[0])(&c1);   // prints "Cat meows"  -- verified
// identical result to just calling d1.speak() / c1.speak() normally
```

**6. Pure virtual / abstract classes**
```cpp
class Shape {
public:
    virtual double area() const = 0;   // pure virtual: vtable slot is a "trap", not real code
    virtual ~Shape() = default;
};
// Shape s;                // ERROR: cannot instantiate abstract class

class Circle : public Shape {
public:
    Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
private:
    double r_;
};
Shape* s = new Circle(2.0);
s->area();   // 12.5664 -- verified
```

**7. Multiple inheritance → multiple vptrs (this-pointer adjustment)**
```cpp
class Flyer   { public: virtual void fly()  const {...} virtual ~Flyer()=default; };
class Swimmer { public: virtual void swim() const {...} virtual ~Swimmer()=default; };
class Duck : public Flyer, public Swimmer {
public:
    void fly()  const override { std::cout << "Duck flies\n"; }
    void swim() const override { std::cout << "Duck swims\n"; }
};
```
```cpp
sizeof(Flyer);   // 8  -- one vptr
sizeof(Duck);    // 16 -- TWO vptrs, one per base subobject

Duck duck;
Flyer*   f = &duck;   // points at the START of duck (Flyer subobject's vptr)
Swimmer* w = &duck;   // points 8 bytes LATER (Swimmer subobject's vptr) -- verified,
                        // addresses differ by exactly sizeof(void*)
f->fly();               // Duck flies  -- verified
w->swim();               // Duck swims  -- verified
```
The compiler silently adjusts `this` when converting `Duck*` to `Swimmer*` — that's why the two pointers have different addresses even though they refer to the same object.

Quick reference:
```
vtable  → one per CLASS, a static array of function pointers (one slot per virtual fn)
vptr    → one per OBJECT (per base subobject, for multiple inheritance), set by ctor,
          points at the class's vtable
virtual call   → read vptr -> index into vtable -> jump through function pointer
non-virtual call → resolved at COMPILE TIME from the static (declared) type — no indirection

virtual keyword     → REQUIRED for dynamic dispatch; omitting it = static dispatch (common bug)
sizeof + vptr        → adds 8 bytes (64-bit) to any class with >=1 virtual function
slicing              → copying a derived object INTO a base object by value resets the vptr
                        -> polymorphism ONLY works via pointer/reference, never by value
pure virtual (= 0)   → vtable slot is a trap; class becomes abstract, cannot instantiate
multiple inheritance → multiple vptrs, one per base subobject; this-pointer gets adjusted
                        automatically when converting between base pointer types
```

**8. `dynamic_cast` — safe runtime downcasting, built on the same RTTI info**

Alongside each vtable, the compiler also stores a pointer to `type_info` (RTTI — Run-Time Type Information) for that class. `dynamic_cast` uses this at runtime to check "is the object I'm pointing at ACTUALLY a `Dog`?" before allowing the downcast — unlike `static_cast`, which just trusts you and does no runtime check at all.

```cpp
class Animal { public: virtual void speak() const {...} virtual ~Animal()=default; };
class Dog : public Animal { public: void speak() const override {...} void fetch() const {...} };
class Cat : public Animal { public: void speak() const override {...} };

Animal* a1 = new Dog();
Animal* a2 = new Cat();

Dog* d1 = dynamic_cast<Dog*>(a1);   // a1 really IS a Dog  -> succeeds, d1 != nullptr
Dog* d2 = dynamic_cast<Dog*>(a2);   // a2 is a Cat, not Dog -> FAILS, d2 == nullptr (no crash)
if (d1) d1->fetch();                  // safe pattern: check before using Dog-only methods
```
Verified output: `dynamic_cast<Dog*>(a1) succeeded? 1` / `dynamic_cast<Dog*>(a2) succeeded? 0`.

**On references, failure throws instead of returning null** (there's no such thing as a "null reference"):
```cpp
try {
    Dog& dref = dynamic_cast<Dog&>(*a2);   // *a2 is a Cat -> throws
} catch (const std::bad_cast& e) {
    std::cout << e.what();   // "std::bad_cast" -- verified
}
```

**Requires a polymorphic source type** (at least one `virtual` function) — RTTI only exists for classes with a vtable:
```cpp
class Base { public: int x; };            // no virtual functions
Derived* d = dynamic_cast<Derived*>(&b);
// error: cannot 'dynamic_cast' (source type is not polymorphic)   -- verified
```

**9. `typeid` — asking an object what it really is**

`typeid(expr)` returns a `std::type_info` reference. If `expr` is a polymorphic glvalue (an object, not a pointer, of a class with virtual functions), the check is done at RUNTIME via the same RTTI slot `dynamic_cast` uses. Otherwise it's resolved at COMPILE TIME from the static type.

```cpp
Animal* a1 = new Dog();
std::cout << typeid(*a1).name();      // "3Dog"      -- dereferenced -> dynamic, real object type
std::cout << typeid(a1).name();       // "P6Animal"  -- the POINTER's type itself -> static, Animal*

typeid(*a1) == typeid(Dog);            // true  -- verified
typeid(*a1) == typeid(Cat);            // false -- verified

class NotPolymorphic { public: int x; };   // no virtual functions
NotPolymorphic np;
typeid(np).name();                      // "14NotPolymorphic" -- resolved statically, no vtable involved
```
Note: `.name()` returns a compiler-mangled string (implementation-defined), not necessarily human-readable — GCC shows `3Dog` (length-prefixed) rather than just `Dog`.

Quick reference:
```
dynamic_cast<T*>(ptr)   → returns nullptr on failure           -- check before use
dynamic_cast<T&>(ref)   → throws std::bad_cast on failure       -- no such thing as null ref
dynamic_cast requires   → source must be POLYMORPHIC (>=1 virtual fn) -- else compile error
static_cast vs dynamic_cast → static_cast: no runtime check, trusts you, faster
                              dynamic_cast: runtime RTTI check, safe, slightly slower
typeid(*ptr)  vs typeid(ptr) → dereferenced = dynamic (real object type via RTTI)
                                the pointer itself = static (declared pointer type)
typeid on non-polymorphic type → always static/compile-time, no RTTI lookup needed
.name()                  → mangled/implementation-defined string, not guaranteed readable
```

---

## 27. std::optional & std::variant — Type-Safe Value Semantics

Both are C++17 vocabulary types stored **inline** (no heap allocation, unlike a pointer) that make "this might not have a value" or "this could be one of several types" explicit in the type system, instead of relying on sentinels (`-1`, `nullptr`) or unsafe C-style unions.

**`std::optional<T>` — a value that may or may not be present**

```cpp
#include <optional>

std::optional<int> findIndex(const std::string& s, char c) {
    auto pos = s.find(c);
    if (pos == std::string::npos) return std::nullopt;   // "no value" -- no need for a -1 sentinel
    return static_cast<int>(pos);                           // implicitly wraps into optional<int>
}
```
Usage (verified):
```cpp
auto r1 = findIndex("hello", 'l');   // found  -> has a value
auto r2 = findIndex("hello", 'z');   // not found -> empty

r1.has_value();          // true
r2.has_value();           // false
(bool)r1;                  // true  -- same meaning as has_value()

*r1;                        // 2  -- dereference like a pointer
r1.value();                  // 2  -- same, but throws if empty
r2.value_or(-1);              // -1 -- fallback default when empty

r2.value();   // throws std::bad_optional_access -- caught, prints "bad optional access"

std::optional<std::string> name;      // default-constructed = empty
name.emplace("Aaron");                  // constructs the string IN PLACE (no temp + copy)
name.reset();                             // back to empty

std::optional<std::string> word = "abcdef";
word->size();                              // 6 -- operator-> forwards into the contained object
```

**`std::variant<Types...>` — a type-safe tagged union, exactly ONE active type at a time**

```cpp
#include <variant>

std::variant<int, double, std::string> v;   // default: holds the FIRST alternative (int, value 0)
v.index();                                     // 0 -- int is currently active

v = 42;
std::holds_alternative<int>(v);   // true
std::get<int>(v);                   // 42

v = std::string("hello");
v.index();                            // 2  -- std::string is now active
std::get<std::string>(v);              // "hello"

std::get<int>(v);   // v currently holds a string -> throws std::bad_variant_access -- verified
```
`get_if` is the non-throwing alternative — returns a pointer, or `nullptr` if that type isn't active:
```cpp
if (auto* p = std::get_if<std::string>(&v)) { /* *p == "hello" */ }
std::get_if<int>(&v) == nullptr;   // true -- verified
```

`std::visit` calls the matching overload based on whichever type is currently active — the standard way to build the "overload set" is a small helper struct combining lambdas via a deduction guide:
```cpp
template<class... Ts> struct overloaded : Ts... { using Ts::operator()...; };
template<class... Ts> overloaded(Ts...) -> overloaded<Ts...>;

v = 3.14;
std::visit(overloaded{
    [](int i)               { std::cout << "int "    << i; },
    [](double d)              { std::cout << "double " << d; },
    [](const std::string& s)  { std::cout << "string " << s; }
}, v);
// prints "double 3.14"  -- verified; reassign v = "world" and it prints "string world" instead
```

`std::monostate` gives a variant an "empty-like" state when the first alternative can't be default-constructed:
```cpp
struct NoDefault { NoDefault(int) {} };          // no default constructor
std::variant<std::monostate, NoDefault> mv;      // ok -- monostate is default-constructible
mv.index();                                        // 0 -- monostate is the active/empty state
```

Quick reference:
```
std::optional<T>          → 0 or 1 value, stored inline, no heap allocation
nullopt                     → the "empty" state
has_value() / (bool)opt      → check presence
*opt / opt.value()            → access; value() throws bad_optional_access if empty
opt.value_or(default)          → safe fallback, never throws
opt.emplace(args...)            → construct value in place (avoids temporary + copy)
opt.reset()                      → clear back to empty

std::variant<T1,T2,...>    → exactly ONE active type from the list, stored inline (tagged union)
default-constructed variant  → holds the FIRST alternative (must be default-constructible,
                                or put std::monostate first if it isn't)
v.index()                     → which alternative is active (0-based)
holds_alternative<T>(v)        → bool check without accessing the value
get<T>(v)                       → access; throws bad_variant_access if T isn't active
get_if<T>(&v)                    → non-throwing; returns pointer or nullptr
std::visit(overloaded{...}, v)    → dispatch to the right lambda for whichever type is active

why prefer these over raw pointer/union tricks:
  optional  → no magic sentinel values (-1, nullptr) needed to mean "nothing"
  variant   → compiler enforces you only access the type that's actually active
              (raw unions let you read the wrong member silently -- undefined behavior)
```

---

## 28. std::visit & the `overloaded` Pattern — Deep Dive

**Step 1: a lambda is really just a compiler-generated class with `operator()`**

Every lambda expression creates a unique, unnamed "closure type" with its own `operator()`. Two lambdas with identical bodies are still two DIFFERENT types.

```cpp
auto lam1 = [](int x) { return x * 2; };
auto lam2 = [](double x) { return x * 3; };

lam1(5);                          // 10 -- really calls lam1.operator()(5)
typeid(lam1) == typeid(lam2);       // false -- verified, genuinely different classes
```
This is WHY `overloaded` needs multiple inheritance: to get one object that has several different `operator()`s, you need to inherit from several different lambda "classes" simultaneously.

**Step 2: `struct overloaded : Ts...` — inherit from every lambda type in the pack**

```cpp
template<class... Ts> struct overloaded : Ts... { using Ts::operator()...; };
```
`Ts...` is a template parameter pack (zero or more types). `: Ts...` pack-expands into a multiple-inheritance base list — e.g. for `overloaded<LambdaA, LambdaB, LambdaC>`, this becomes `struct overloaded : LambdaA, LambdaB, LambdaC`. The new struct now physically CONTAINS all three closure objects as base subobjects, each with its own `operator()`.

**Step 3: `using Ts::operator()...;` — merge all the inherited `operator()`s into ONE overload set**

Without this line, calling `ov(5)` on a struct that inherits `operator()` from multiple unrelated bases is **ambiguous** — the compiler can't tell which base's `operator()` you mean, even though only one of them actually matches the argument type. Verified:
```cpp
template<class... Ts> struct overloaded_broken : Ts... {};   // no using-declaration
overloaded_broken ov{ [](int i){...}, [](double d){...} };
ov(5);
// error: request for member 'operator()' is ambiguous
// candidates: lambda(double), lambda(int)
```
`using Ts::operator()...;` pulls each base's `operator()` into `overloaded`'s OWN scope, combining them into a single unified overload set — exactly like writing several overloaded member functions by hand. THEN normal overload resolution (matching argument types) picks the right one, with no ambiguity:
```cpp
template<class... Ts> struct overloaded : Ts... { using Ts::operator()...; };
// now ov(5) unambiguously picks operator()(int), ov(3.14) picks operator()(double)
```

**Step 4: the deduction guide — why `overloaded{lambda1, lambda2}` even compiles**

```cpp
template<class... Ts> overloaded(Ts...) -> overloaded<Ts...>;
```
`overloaded` has no user-written constructor — `overloaded{a, b, c}` relies on aggregate initialization (legal since C++17 allows aggregates to have base classes). But the compiler still needs to figure out WHAT `Ts...` even is from `overloaded{lambda1, lambda2}` — that's Class Template Argument Deduction (CTAD), and aggregates don't get it automatically pre-C++20. A **deduction guide** is a small extra rule you hand the compiler: "if you see something that looks like a call `overloaded(Ts...)`, deduce the class template as `overloaded<Ts...>`." Without it:
```cpp
template<class... Ts> struct overloaded : Ts... { using Ts::operator()...; };
// NO deduction guide
overloaded ov{ [](int){}, [](double){} };
// error: class template argument deduction failed -- verified
```
With the guide added back, it compiles immediately — the guide is the ONLY thing that changed.

**Putting it together — `overloaded{}` is just a normal callable, `std::visit` is what feeds it the active alternative**

```cpp
overloaded ov{
    [](int i)                { std::cout << "int: " << i << "\n"; },
    [](double d)               { std::cout << "double: " << d << "\n"; },
    [](const std::string& s)    { std::cout << "string: " << s << "\n"; }
};
ov(5);              // "int: 5"     -- verified, works standalone, no variant/visit involved at all
ov(3.14);            // "double: 3.14" -- verified

std::variant<int, double, std::string> v = 42;
std::visit(ov, v);    // "int: 42" -- verified; std::visit just calls ov(whatever v currently holds)
```

**What `std::visit` actually does internally — index-based dispatch**

Conceptually, `std::visit(visitor, v)` looks at `v.index()` and calls `visitor(std::get<I>(v))` for whichever `I` is active — essentially a switch statement (real implementations use a generated jump table of function pointers, the same kind of mechanism as the vtable dispatch from section 26). Proven with a hand-rolled version that produces identical output to the real thing:
```cpp
template<class Visitor>
void my_visit(Visitor&& vis, std::variant<int, double, std::string>& v) {
    switch (v.index()) {
        case 0: vis(std::get<0>(v)); break;
        case 1: vis(std::get<1>(v)); break;
        case 2: vis(std::get<2>(v)); break;
    }
}
// my_visit(overloaded{...}, v) and std::visit(overloaded{...}, v)
// print the IDENTICAL line for the same v -- verified
```

**`std::visit` can return a value**, as long as every lambda's return type is compatible:
```cpp
auto describe = overloaded{
    [](int i)    -> std::string { return "int(" + std::to_string(i) + ")"; },
    [](double d) -> std::string { return "double(" + std::to_string(d) + ")"; }
};
std::variant<int, double> nums = 10;
std::string result = std::visit(describe, nums);   // "int(10)" -- verified
```

**`std::visit` can dispatch over MULTIPLE variants at once** (cartesian — it picks the overload matching the combination of active types):
```cpp
std::variant<int, std::string> a = 1;
std::variant<int, std::string> b = std::string("x");
std::visit(overloaded{
    [](int, int)                       { std::cout << "int,int\n"; },
    [](int, const std::string&)         { std::cout << "int,string\n"; },
    [](const std::string&, int)          { std::cout << "string,int\n"; },
    [](const std::string&, const std::string&) { std::cout << "string,string\n"; }
}, a, b);
// prints "int,string" -- verified (a is int, b is string)
```

Quick reference:
```
lambda            → compiler-generated unique class with its own operator(); two lambdas,
                     even identical ones, are always DIFFERENT types
struct overloaded : Ts...    → multiple inheritance, one base subobject per lambda type,
                                so the derived object physically has all their operator()s
using Ts::operator()...;      → REQUIRED -- merges every base's operator() into ONE overload
                                 set; omit it and calls become ambiguous (verified error)
deduction guide                → REQUIRED -- tells the compiler how to deduce Ts... from
                                  overloaded{a, b, c} braced-init syntax; omit it and CTAD
                                  fails to compile (verified error)
overloaded{...}                 → produces an ordinary callable object; works standalone,
                                   with no dependency on std::variant or std::visit at all
std::visit(visitor, v)           → conceptually: switch on v.index(), call visitor(get<I>(v))
                                    for whichever I is active (jump-table style, like a vtable)
std::visit + multiple variants     → cartesian dispatch; visitor needs an overload for every
                                      combination of active alternatives actually used
std::visit return value             → allowed; every visitor branch must return a compatible type
```

---

## 29. std::expected<T, E> — Type-Safe Error Handling (C++23)

> Note on verification: this sandbox ships GCC 11, which predates `<expected>` entirely.
> To keep rule #3 (verify before writing), I pulled in GCC 13's `<expected>` header (where
> `<expected>` gained its monadic operations) and got it compiling/running under GCC 11 by
> resolving a couple of header-version mismatches. Every example below is real compiled and
> executed output, not hand-written guesses. In a normal up-to-date toolchain (GCC 13+,
> Clang 16+, MSVC 19.35+) this all works out of the box with just `#include <expected>`.

**The problem it solves:** `std::optional<T>` (section 27) tells you SOMETHING failed but not WHY. Exceptions carry a reason but are heavyweight, invisible in the function signature, and awkward for expected/recoverable failures (a failed parse isn't exceptional). `std::expected<T, E>` holds EITHER a success value of type `T` OR an error value of type `E`, right there in the type signature — the caller can see exactly what a function returns and exactly how it can fail, with zero exceptions and zero heap allocation.

**1. Basic construction and access**

```cpp
#include <expected>

std::expected<int, std::string> parsePositive(int x) {
    if (x <= 0) return std::unexpected("must be positive");   // failure: wrap error in unexpected
    return x;                                                    // success: implicit from T
}
```
Usage (verified):
```cpp
auto r1 = parsePositive(5);
auto r2 = parsePositive(-3);

r1.has_value();          // true
r2.has_value();           // false
(bool)r1;                  // true -- same meaning as has_value()

*r1;                        // 5 -- dereference like optional, only valid when has_value()
r1.value();                  // 5 -- same, but throws if empty

r2.error();                   // "must be positive" -- ONLY valid when !has_value()

r1.value_or(-1);               // 5   -- has a value, fallback unused
r2.value_or(-1);                // -1  -- fallback used

r2.value();   // throws std::bad_expected_access<std::string>, WRAPPING the error inside the exception
// caught e.error() == "must be positive"  -- verified
```
`.value()` throwing `bad_expected_access<E>` (which itself carries `.error()`) is the bridge between the no-exceptions style and exception-based code — you opt into an exception only at the one call site where you choose `.value()` instead of checking `has_value()` first.

**2. Monadic operations — chain fallible steps without manual if/else forwarding**

This is what makes `expected` more than "optional with a reason." Four composable operations, each behaving differently depending on whether the current `expected` holds a value or an error:

```cpp
enum class Err { Empty, NotANumber, Negative, TooLarge };

std::expected<int, Err> parse(const std::string& s) { ... }     // string -> int or error
std::expected<int, Err> positive(int x) { ... }                   // int -> int or error
std::expected<int, Err> capped(int x) { ... }                      // int -> int or error
```

`and_then(f)` — if there's a value, call `f(value)` (which must itself return an `expected` with the SAME error type) and return that; if there's an error, skip `f` entirely and propagate the existing error untouched:
```cpp
auto processChained(const std::string& s) {
    return parse(s).and_then(positive).and_then(capped);
}
```
Verified against a hand-written manual version doing the same job with explicit `if (!r) return std::unexpected(r.error());` after every step:
```cpp
input="50"   manual=50           chained=50           match=1
input="-5"   manual=Negative     chained=Negative      match=1   -- positive() failed
input="abc"  manual=NotANumber   chained=NotANumber     match=1   -- parse() failed, positive()/capped() never even called
input="500"  manual=TooLarge     chained=TooLarge        match=1   -- capped() failed
input=""     manual=Empty        chained=Empty            match=1   -- parse() failed on empty string
```
Identical results with far less boilerplate — `and_then` IS the "if error, return early" pattern, just built into the type.

`transform(f)` — apply `f` to the VALUE if present (result gets auto-wrapped back into an `expected`); if there's an error, `f` is skipped and the error passes through unchanged:
```cpp
parseInt("21").transform([](int x){ return x * 2; });    // holds 42     -- verified
parseInt("abc").transform([](int x){ return x * 2; });   // still holds the ORIGINAL error -- verified
```

`transform_error(f)` — the mirror image: applies `f` to the ERROR if present, leaves the value alone otherwise. Handy for enriching or converting error types along a pipeline:
```cpp
parseInt("abc").transform_error([](ParseError e){ return "parse failed: " + toString(e); });
// error becomes "parse failed: NotANumber"  -- verified
```

`or_else(f)` — recovery: if there's an error, call `f(error)` (must return an `expected` of the SAME value type) to supply a fallback; if there's a value, pass it through unchanged:
```cpp
parseInt("abc").or_else([](ParseError) -> std::expected<int, ParseError> { return 0; });
// recovered value = 0  -- verified
```

**3. `std::expected<void, E>` — an operation that can fail but has no value to return**

```cpp
std::expected<void, WriteError> writeFile(bool simulateFull) {
    if (simulateFull) return std::unexpected(WriteError::DiskFull);
    return {};   // success for expected<void,E> is just an empty braces -- no value to give
}
```
```cpp
writeFile(false).has_value();   // true
writeFile(true).has_value();     // false
writeFile(true).error();          // WriteError::DiskFull -- verified
// no operator* here -- there's no value, only success/failure + an error on failure
```

**4. Why not just reuse `optional` or `variant<T,E>`?**

```
optional<T>       → knows IF it failed, not WHY -- no error information at all
variant<T, E>      → CAN hold either, but nothing stops you writing variant<E, T> instead
                      by mistake (no semantic labeling of "success slot" vs "error slot"),
                      and none of the built-in monadic ergonomics (and_then/or_else/etc.)
                      exist for arbitrary variants tailored to this success/fail pattern
expected<T, E>      → purpose-built: value slot and error slot are semantically distinct,
                       with and_then/transform/or_else/transform_error designed specifically
                       around "propagate on error, continue on success" pipelines
```

Quick reference:
```
std::expected<T, E>        → holds EITHER a T (success) or an E (error), inline, no heap alloc
std::unexpected(e)           → wraps an error value for returning/constructing the failure case
success case                  → return value directly (implicit conversion to expected<T,E>)
failure case                   → return std::unexpected(errorValue)

has_value() / (bool)e          → check success
*e / e.value()                   → access value; value() throws bad_expected_access<E> if error
e.error()                         → access error; ONLY valid when !has_value()
e.value_or(default)                → safe fallback, never throws

and_then(f)          → f(value) -> expected<U,E>; SAME error type; skips f on error, propagates error
transform(f)          → f(value) -> U; auto-wraps as expected<U,E>; skips f on error, propagates error
transform_error(f)     → f(error) -> E2; converts/enriches the error; passes value through untouched
or_else(f)               → f(error) -> expected<T,E2>; RECOVERS from error; passes value through untouched

expected<void, E>          → success = return {}; no operator*, only has_value()/error()

requires (this environment) → C++23, GCC 13+ / Clang 16+ / MSVC 19.35+ for full monadic support;
                               this sandbox's default GCC 11 needed a header workaround to verify
```

---

## 30. Callables + std::thread + Synchronization — Advanced Deep-Dive

### Part 1: Callables — the five things C++ lets you "call like a function"

```cpp
#include <functional>

int add(int a, int b) { return a + b; }              // 1. plain function
int (*fp)(int, int) = add;                             // 2. function pointer

struct Multiplier {                                     // 3. functor (object with operator())
    int factor;
    int operator()(int x) const { return x * factor; }
};

auto square = [](int x) { return x * x; };               // 4. lambda -- sugar for a compiler-generated functor

struct Widget {                                            // 5. member function pointer -- needs an OBJECT
    int value = 10;
    int getValue() const { return value; }
};
```
Usage (verified):
```cpp
add(2, 3);            // 5
fp(2, 3);               // 5   -- same function, called through the pointer
times3(7);                // 21  -- functor call
square(5);                 // 25  -- lambda call

int (Widget::*mfp)() const = &Widget::getValue;   // note the ClassName::* syntax
(w.*mfp)();                                          // 10 -- .*  to call through an OBJECT
(wp->*mfp)();                                         // 10 -- ->* to call through a POINTER
```
Member function pointers need this special `.*`/`->*` syntax because a bare member function has no meaning without an object to run on — `&Widget::getValue` is essentially "an offset into any Widget," not a callable address by itself.

**`std::invoke`** is the unifying syntax that works identically across ALL FIVE kinds — useful when writing generic code that shouldn't care which kind of callable it received:
```cpp
std::invoke(add, 2, 3);       // 5
std::invoke(fp, 2, 3);         // 5
std::invoke(times3, 7);         // 21
std::invoke(square, 5);          // 25
std::invoke(mfp, w);              // 10 -- no .* needed, std::invoke handles it internally
std::invoke(mfp, wp);              // 10
```

**`std::function<Signature>`** is a type-erased wrapper that can hold ANY callable matching a given signature — the price is a small runtime overhead (possible heap allocation, virtual dispatch) versus a raw lambda/function pointer:
```cpp
std::function<int(int)> f = square;
f(6);   // 36
f = [times3](int x) { return times3(x); };   // reassign to a totally different callable, same wrapper
f(6);    // 18
```

### Part 2: std::thread — running code concurrently

```cpp
#include <thread>

void worker(int id) { std::cout << "worker " << id << " on thread " << std::this_thread::get_id(); }
```
```cpp
std::thread t1(worker, 1);                          // launch with a plain function + args
std::thread t2([](int x){ ... }, 42);                 // launch with a lambda
std::thread t3(Task{}, "hello");                       // launch with a functor
t1.join(); t2.join(); t3.join();                         // BLOCK until each thread finishes
```
All three verified running on a different thread id than `main`.

**`joinable()`** tells you whether a thread still needs `join()` or `detach()`:
```cpp
t4.joinable();   // true before join()
t4.join();
t4.joinable();   // false after join() -- verified
```

**Forgetting to `join()` or `detach()` before a thread's destructor runs is fatal** — verified: a `std::thread` object going out of scope while still joinable calls `std::terminate()`, aborting the whole program (exit code 134 / SIGABRT):
```cpp
std::thread t(work);
// ... no join(), no detach() ...
return 0;   // t's destructor runs HERE, t.joinable() still true -> std::terminate() -- verified crash
```

**Threads COPY their arguments by default** — passing a reference-taking function needs `std::ref` to force actual reference semantics:
```cpp
void increment(int& c) { c += 100; }
int counter = 0;
std::thread t5(increment, std::ref(counter));   // std::ref -- really modifies counter
t5.join();
counter;   // 100 -- verified, really modified

std::thread t(increment, counter2);   // WITHOUT std::ref
// error: static assertion failed: std::thread arguments must be invocable after conversion to rvalues
// -- verified compile error; increment wants int&, a by-value copy can't bind to it
```

### Part 3: Data races — the problem synchronization solves

`counter++` LOOKS like one operation but is really three: read, modify, write. If two threads interleave these steps, updates get lost. Verified on real hardware (2 cores, `-O0`, 8 threads × 2,000,000 increments each, expected total 16,000,000):
```cpp
int counter = 0;   // shared, UNPROTECTED
void incrementMany() { for (int i=0;i<2000000;++i) counter++; }
// 8 threads launched, all calling incrementMany(), then joined
```
```
expected = 16000000
actual   = 4100960     (run 1)
actual   = 3201298     (run 2)
actual   = 4577071     (run 3)
```
Millions of updates silently lost, a DIFFERENT wrong number every single run — the textbook signature of a data race (undefined behavior, not just "sometimes slow").

### Part 4: Fixing races — std::mutex and std::atomic

**`std::mutex` + `std::lock_guard`** — only one thread may hold the lock at a time; `lock_guard` acquires on construction and releases on destruction (RAII, so it's exception-safe and can't be forgotten):
```cpp
std::mutex m;
int counterMutex = 0;
void incrementMutex() {
    for (int i = 0; i < 2000000; ++i) {
        std::lock_guard<std::mutex> lock(m);   // acquire
        counterMutex++;                          // protected critical section
    }   // lock released automatically here
}
```

**`std::atomic<int>`** — lighter-weight for simple cases; the hardware guarantees the read-modify-write happens as one indivisible step, no mutex needed at all:
```cpp
std::atomic<int> counterAtomic{0};
void incrementAtomic() { for (int i=0;i<2000000;++i) counterAtomic++; }
```
Both fixes verified correct across multiple runs with the same 8-thread workload that previously lost millions of updates:
```
mutex:  expected=16000000 actual=16000000 correct=1   (all 3 runs)
atomic: expected=16000000 actual=16000000 correct=1   (all 3 runs)
```

### Part 5: Deadlock and how to avoid it

Classic deadlock: thread X locks `mA` then waits for `mB`; thread Y locks `mB` then waits for `mA`; both wait forever. **`std::scoped_lock`** (C++17) locks multiple mutexes together using a deadlock-avoiding algorithm internally, regardless of what order each thread requests them in:
```cpp
std::mutex mA, mB;
void safeTransfer(int id, std::mutex& first, std::mutex& second) {
    std::scoped_lock lock(first, second);   // locks BOTH atomically, deadlock-safe
    std::cout << "thread " << id << " acquired both locks safely\n";
}
std::thread t1(safeTransfer, 1, std::ref(mA), std::ref(mB));   // wants mA then mB
std::thread t2(safeTransfer, 2, std::ref(mB), std::ref(mA));   // wants mB then mA -- REVERSED
```
Verified: both threads finish immediately, no hang — `std::scoped_lock` prevents the deadlock even though the two threads request the locks in opposite order.

### Part 6: std::condition_variable — signaling between threads (producer/consumer)

A condition variable lets a thread SLEEP until another thread notifies it, avoiding a wasteful busy-wait loop:
```cpp
std::mutex mtx;
std::condition_variable cv;
std::queue<int> q;
bool done = false;

void producer() {
    for (int i = 1; i <= 5; ++i) {
        { std::lock_guard<std::mutex> lock(mtx); q.push(i); }
        cv.notify_one();   // wake the consumer -- "there's new data"
    }
    { std::lock_guard<std::mutex> lock(mtx); done = true; }
    cv.notify_one();
}
void consumer() {
    while (true) {
        std::unique_lock<std::mutex> lock(mtx);           // unique_lock: cv.wait() needs to unlock/relock it
        cv.wait(lock, [] { return !q.empty() || done; });    // sleeps until predicate true -- no busy-wait
        while (!q.empty()) { /* consume q.front(); q.pop(); */ }
        if (done && q.empty()) break;
    }
}
```
Verified: all 5 items produced and consumed in order, program exits cleanly with no hang.

### Part 7: std::async + std::future — getting a RETURN VALUE from concurrent work

`std::thread` discards its function's return value entirely — there's no built-in way to get it back. `std::async` solves this by returning a `std::future<T>` you can `.get()` later:
```cpp
int slowSquare(int x) { /* ... */ return x * x; }

std::future<int> fut = std::async(std::launch::async, slowSquare, 12);
// ... do other work while slowSquare(12) runs concurrently ...
int result = fut.get();   // BLOCKS until finished, then returns the value -- 144, verified
```
Launching several and collecting all results:
```cpp
std::vector<std::future<int>> futures;
for (int i = 1; i <= 5; ++i) futures.push_back(std::async(std::launch::async, slowSquare, i));
for (auto& f : futures) std::cout << f.get() << " ";
// 1 4 9 16 25 -- verified
```
**`.get()` can only be called ONCE per future** — verified: a second call throws `std::future_error: No associated state` because the result was already consumed and moved out on the first call.

Quick reference:
```
5 kinds of callable  → function, function pointer, functor, lambda, member function pointer
std::invoke(f, args...)  → uniform call syntax across all 5 kinds, no .*/-> needed for member fns
std::function<Sig>         → type-erased wrapper, holds any matching callable, small runtime cost

std::thread(fn, args...)     → args are COPIED by default; use std::ref(x) to pass by reference
t.join()                       → blocks until t finishes; REQUIRED (or t.detach()) before t's destructor runs
forgetting join/detach          → std::terminate() when the thread object is destroyed -- program aborts
t.joinable()                     → true until joined or detached

data race    → unsynchronized concurrent read+write of shared state -- undefined behavior,
               silently loses updates, produces a DIFFERENT wrong answer every run
std::mutex + lock_guard   → RAII lock: acquire on construction, release on destruction
std::atomic<T>              → hardware-guaranteed indivisible read-modify-write, no mutex needed,
                               best for simple counters/flags
std::scoped_lock(m1, m2,...)  → locks multiple mutexes together, deadlock-avoiding, C++17

condition_variable   → cv.wait(lock, predicate) sleeps until notified AND predicate true;
                        needs unique_lock (not lock_guard) because wait() must unlock/relock
cv.notify_one()         → wake one waiting thread; notify_all() wakes all of them

std::thread            → CANNOT return a value from its function -- discarded
std::async + future      → DOES return a value; future.get() blocks until ready, ONE-TIME use only
                            (second .get() call throws std::future_error)
```

---

## Quick Reference — Key Rules

```
explicit        → single arg constructors and conversion operators only
const after ()  → method won't modify object
override        → safety check against base class virtual
= 0             → pure virtual, subclass must implement

const int* p    → pointer to const (data locked)   — low-level const
int* const p    → const pointer (address locked)   — top-level const
const T&        → cheap read-only param, binds temporaries
const object    → only const member functions callable; mutable = escape hatch
typedef+const   → const applies to alias as a whole, not re-parsed
auto            → strips const/ref; auto&/const auto& preserve it

lvalue  → has name, has address → bound by &
rvalue  → temporary, no name   → bound by &&
auto&&  → universal, binds both

Rule of 0   → prefer this, use smart pointers/STL containers
Rule of 5   → needed when owning raw resources

unique_ptr  → always pass as const& when observing
std::move   → just a cast, enables move constructor to run

STL         → containers + algorithms + iterators (part of standard library)
sort/accumulate → STL algorithms, live in <algorithm> and <numeric>

virtual destructor  → declare once on base, propagates forever
                    → always virtual if any virtual method exists
                    → compiler generated is fine if no raw resources owned

protected inheritance → grandchildren can access inherited members
private inheritance   → stops at that class, grandchildren blocked
destruction order     → most derived first, base class last

mixed raw + STL members → custom copy/move MUST handle every member,
                           including STL ones (delegate via their own
                           copy/move ctor — don't loop manually)
                        → forgetting a member compiles silently wrong
                        → best fix: eliminate raw resources, use Rule of 0
```
