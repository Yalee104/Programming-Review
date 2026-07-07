# CUDA — Study Summary

> Note on verification: this sandbox has no NVIDIA GPU, so CUDA code can't be executed here.
> Every example's index math and algorithm was verified by running an exact CPU emulation
> (g++) of the kernel logic — the outputs in comments are real computed results, not guessed.
> Compile the CUDA versions on your GPU machine with the `nvcc` commands shown.

## 1. The Mental Model — Host vs Device

CUDA programs have two sides:

```
Host   = the CPU + system RAM        → runs normal C++ code, orchestrates everything
Device = the GPU + its own memory    → runs "kernels": functions launched across
                                       thousands of lightweight threads at once
```

The core pattern of almost every CUDA program:

```cpp
// 1. allocate memory on the GPU
// 2. copy input data:   host → device
// 3. launch kernel      (GPU executes it with many threads in parallel)
// 4. copy results back:  device → host
// 5. free GPU memory
```

Key mindset shift: instead of a loop that processes elements one-by-one,
you write the body of the loop once (the kernel), and launch one thread per element.

```cpp
// CPU way: one thread walks the array
for (int i = 0; i < n; i++) c[i] = a[i] + b[i];

// GPU way: n threads each do ONE iteration, simultaneously
// (each thread computes its own i — see section 4)
c[i] = a[i] + b[i];
```

---

## 2. First Kernel — `__global__` and `<<< >>>`

`__global__` marks a function as a kernel: called from host, runs on device.
`<<<blocks, threadsPerBlock>>>` is the launch configuration.

```cpp
// hello.cu
#include <cstdio>

__global__ void hello() {
    printf("Hello from block %d, thread %d\n", blockIdx.x, threadIdx.x);
}

int main() {
    hello<<<2, 3>>>();          // 2 blocks × 3 threads = 6 threads total
    cudaDeviceSynchronize();    // wait for GPU to finish (kernel launches are async!)
    return 0;
}
```

Output — 6 lines, one per thread. Order between blocks is NOT guaranteed
(blocks run whenever the GPU schedules them):

```
Hello from block 0, thread 0
Hello from block 0, thread 1
Hello from block 0, thread 2
Hello from block 1, thread 0
Hello from block 1, thread 1
Hello from block 1, thread 2
```

Two things beginners hit immediately:
- Kernels return `void` and launches are **asynchronous** — without
  `cudaDeviceSynchronize()`, `main` can exit before the GPU prints anything.
- Kernels can't be called like normal functions; the `<<< >>>` is mandatory.

---

## 3. Compiling & Running

```bash
nvcc hello.cu -o hello        # nvcc = NVIDIA's compiler driver (wraps g++/cl for host code)
./hello

# useful flags
nvcc -O2 vec_add.cu -o vec_add                # optimize
nvcc -arch=native hello.cu -o hello           # build for YOUR GPU's architecture
nvcc -arch=sm_86 hello.cu -o hello            # or target explicitly (sm_86 = RTX 30xx)
```

Check your GPU and driver:

```bash
nvidia-smi          # GPU model, driver, memory usage
nvcc --version      # toolkit version
```

File extension matters: CUDA source must be `.cu`, or nvcc treats it as plain C++.

---

## 4. Thread Hierarchy — Who Am I?

Threads are organized as: **grid → blocks → threads**.
Inside a kernel, built-in variables tell each thread where it is:

```cpp
threadIdx.x   // my index WITHIN my block       (0 .. blockDim.x-1)
blockIdx.x    // my block's index in the grid   (0 .. gridDim.x-1)
blockDim.x    // threads per block
gridDim.x     // blocks in the grid
```

The single most important line in CUDA — converting to a unique global index:

```cpp
int idx = blockIdx.x * blockDim.x + threadIdx.x;
```

```cpp
__global__ void showIndex() {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    printf("block %d, thread %d -> global idx %d\n", blockIdx.x, threadIdx.x, idx);
}

showIndex<<<3, 4>>>();      // 3 blocks × 4 threads = 12 threads
cudaDeviceSynchronize();
```

Output (verified; per-block line order may interleave):

```
block 0, thread 0 -> global idx 0
block 0, thread 1 -> global idx 1
block 0, thread 2 -> global idx 2
block 0, thread 3 -> global idx 3
block 1, thread 0 -> global idx 4
block 1, thread 1 -> global idx 5
block 1, thread 2 -> global idx 6
block 1, thread 3 -> global idx 7
block 2, thread 0 -> global idx 8
block 2, thread 1 -> global idx 9
block 2, thread 2 -> global idx 10
block 2, thread 3 -> global idx 11
```

Why blocks at all? A block's threads run on the same SM (streaming multiprocessor),
can share fast memory (section 10), and can synchronize with each other.
Blocks are the unit the GPU scales with — more SMs, more blocks run concurrently.

Limits: max 1024 threads per block; typical choices are 128–512.

---

## 5. The Standard Workflow — Vector Add

The canonical complete program. This pattern is 90% of beginner CUDA:

```cpp
// vec_add.cu
#include <cstdio>

__global__ void vecAdd(const float* a, const float* b, float* c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n)                  // guard: grid may have more threads than elements
        c[i] = a[i] + b[i];
}

int main() {
    const int N = 8;
    const size_t bytes = N * sizeof(float);

    // host data
    float ha[N], hb[N], hc[N];
    for (int i = 0; i < N; i++) { ha[i] = i; hb[i] = 10.0f * i; }

    // 1. allocate device memory
    float *da, *db, *dc;
    cudaMalloc(&da, bytes);
    cudaMalloc(&db, bytes);
    cudaMalloc(&dc, bytes);

    // 2. copy host → device
    cudaMemcpy(da, ha, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(db, hb, bytes, cudaMemcpyHostToDevice);

    // 3. launch: enough blocks to cover N (round up!)
    int threads = 4;
    int blocks  = (N + threads - 1) / threads;   // = 2
    vecAdd<<<blocks, threads>>>(da, db, dc, N);

    // 4. copy device → host (cudaMemcpy waits for the kernel to finish)
    cudaMemcpy(hc, dc, bytes, cudaMemcpyDeviceToHost);

    for (int i = 0; i < N; i++) printf("c[%d] = %g\n", i, hc[i]);

    // 5. free
    cudaFree(da); cudaFree(db); cudaFree(dc);
    return 0;
}
```

Output (verified):

```
c[0] = 0
c[1] = 11
c[2] = 22
c[3] = 33
c[4] = 44
c[5] = 55
c[6] = 66
c[7] = 77
```

Two idioms to memorize:
- `(N + threads - 1) / threads` — ceiling division so every element gets a thread.
- `if (i < n)` — the last block usually has leftover threads; without the guard
  they write out of bounds.

---

## 6. Grid-Stride Loop — Handling Any N

What if N is bigger than the total number of threads you launched?
Each thread processes multiple elements, striding by the total thread count:

```cpp
__global__ void scale(float* x, float f, int n) {
    int stride = blockDim.x * gridDim.x;              // total threads in grid
    for (int i = blockIdx.x * blockDim.x + threadIdx.x; i < n; i += stride)
        x[i] *= f;
}

// host setup: N=10, x[i] = i initially, f = 2.0
const int N = 10;
const size_t bytes = N * sizeof(float);
float hx[N];
for (int i = 0; i < N; i++) hx[i] = i;
float* dx;
cudaMalloc(&dx, bytes);
cudaMemcpy(dx, hx, bytes, cudaMemcpyHostToDevice);

// only <<<2,4>>> = 8 threads for 10 elements: threads 0 and 1 each handle 2
scale<<<2, 4>>>(dx, 2.0f, N);

cudaMemcpy(hx, dx, bytes, cudaMemcpyDeviceToHost);   // copy results back into hx
cudaFree(dx);
```

Output after copy-back (verified):

```
x[0] = 0    x[5] = 10
x[1] = 2    x[6] = 12
x[2] = 4    x[7] = 14
x[3] = 6    x[8] = 16    // thread 0's second element (0 + 8)
x[4] = 8    x[9] = 18    // thread 1's second element (1 + 8)
```

This is the recommended default kernel shape: correct for any N,
lets you tune block/grid size for performance without touching correctness.

---

## 7. Error Checking

CUDA calls fail silently unless you check. Two failure channels:

```cpp
// A. API calls return cudaError_t
cudaError_t err = cudaMalloc(&d, bytes);
if (err != cudaSuccess)
    printf("error: %s\n", cudaGetErrorString(err));

// B. kernel launches return nothing — check afterwards
vecAdd<<<blocks, threads>>>(da, db, dc, N);
cudaError_t launchErr = cudaGetLastError();          // bad config, etc.
cudaError_t runErr    = cudaDeviceSynchronize();     // errors during execution
```

Standard macro everyone uses:

```cpp
#define CUDA_CHECK(call)                                                  \
    do {                                                                  \
        cudaError_t err_ = (call);                                        \
        if (err_ != cudaSuccess) {                                        \
            fprintf(stderr, "CUDA error %s at %s:%d\n",                   \
                    cudaGetErrorString(err_), __FILE__, __LINE__);        \
            exit(1);                                                      \
        }                                                                 \
    } while (0)

CUDA_CHECK(cudaMalloc(&da, bytes));
CUDA_CHECK(cudaMemcpy(da, ha, bytes, cudaMemcpyHostToDevice));
```

Example of a caught error — asking for 2000 threads per block (max is 1024):

```cpp
vecAdd<<<1, 2000>>>(da, db, dc, N);
CUDA_CHECK(cudaGetLastError());
// CUDA error invalid configuration argument at vec_add.cu:42
```

---

## 8. Function Qualifiers — `__global__` vs `__device__` vs `__host__`

```cpp
__global__ void kernel();        // called from HOST, runs on DEVICE, must return void
__device__ float helper(float);  // called from DEVICE code only, runs on device
__host__   void normal();        // plain CPU function (default — rarely written)

__host__ __device__ float both(float x) { return x * x; }
// compiled twice — usable from CPU code AND inside kernels
```

```cpp
__device__ float square(float x) { return x * x; }   // device-side helper

__global__ void sumOfSquares(const float* in, float* out, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) out[i] = square(in[i]);               // kernel calls __device__ fn
}

// in = {1, 2, 3, 4}  →  out = {1, 4, 9, 16}
```

Calling a `__device__` function from `main`, or a `__host__` function from a
kernel, is a compile error — the qualifiers exist so nvcc knows where each
function must be compiled to run.

---

## 9. Memory Spaces Overview

From fastest/smallest to slowest/largest:

```cpp
__global__ void memoryTour(const float* gdata) {
    int local = 0;                 // register      — per-thread, fastest
    float spill[100];              // local memory  — per-thread arrays too big
                                   //                 for registers (actually in global!)
    __shared__ float tile[256];    // shared memory — per-BLOCK, on-chip, fast,
                                   //                 threads in a block cooperate here
    float g = gdata[0];            // global memory — the GPU's main RAM (cudaMalloc),
                                   //                 visible to all threads, slow-ish
}

__constant__ float coeffs[16];     // constant memory — read-only from kernels,
                                   //   set from host with cudaMemcpyToSymbol,
                                   //   cached + broadcast: fast when all threads
                                   //   read the SAME element
```

Rules of thumb:
- Data arrives in **global** memory (`cudaMalloc` + `cudaMemcpy`).
- If threads in a block reuse the same data multiple times, stage it in **shared**.
- Small read-only parameters all threads use → **constant**.
- Host↔device transfers over PCIe are the slowest link — minimize copies.

---

## 10. Shared Memory & `__syncthreads()`

`__shared__` memory is a small (~48KB+) fast scratchpad shared by a block's threads.
Because threads run in parallel, you must **sync** between "everyone writes" and
"everyone reads" phases, or you read garbage.

Example — each element becomes the sum of itself and its neighbors
(each `in[i]` is read 3 times; shared memory pays off on real sizes):

```cpp
__global__ void neighborSum(const int* in, int* out, int n) {
    __shared__ int tile[8];
    int i = threadIdx.x;                    // single block: local == global index

    tile[i] = in[i];                        // phase 1: every thread loads one element
    __syncthreads();                        // WAIT — all loads done before any reads

    int left  = (i == 0)     ? 0 : tile[i - 1];
    int right = (i == n - 1) ? 0 : tile[i + 1];
    out[i] = left + tile[i] + right;        // phase 2: read neighbors from fast memory
}

// host setup: in = {1, 2, 3, 4, 5, 6, 7, 8}
int hin[8] = {1, 2, 3, 4, 5, 6, 7, 8}, hout[8];
int *din, *dout;
cudaMalloc(&din, 8 * sizeof(int));
cudaMalloc(&dout, 8 * sizeof(int));
cudaMemcpy(din, hin, 8 * sizeof(int), cudaMemcpyHostToDevice);

neighborSum<<<1, 8>>>(din, dout, 8);

cudaMemcpy(hout, dout, 8 * sizeof(int), cudaMemcpyDeviceToHost);   // hout holds the result
cudaFree(din); cudaFree(dout);
```

Output (verified):

```
out[0] = 3     // 0+1+2
out[1] = 6     // 1+2+3
out[2] = 9
out[3] = 12
out[4] = 15
out[5] = 18
out[6] = 21
out[7] = 15    // 7+8+0
```

`__syncthreads()` gotchas:
- Only syncs threads **within one block** — there is no cheap grid-wide sync.
- Every thread in the block must reach it — calling it inside a divergent
  `if (threadIdx.x < k)` branch deadlocks/undefined behavior.

---

## 11. Parallel Reduction — Summing an Array

The classic shared-memory pattern: a tree reduction halves the active threads
each step, so a block sums 128 values in log₂(128) = 7 steps instead of 127.

```cpp
__global__ void blockSum(const int* in, int* out) {
    __shared__ int s[128];
    int t = threadIdx.x;

    s[t] = in[blockIdx.x * blockDim.x + t];         // each thread loads one element
    __syncthreads();

    // tree: 64 threads add pairs, then 32, 16, 8, 4, 2, 1
    for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {
        if (t < stride)
            s[t] += s[t + stride];
        __syncthreads();          // outside the if — ALL threads must reach it
    }

    if (t == 0) out[blockIdx.x] = s[0];             // one partial sum per block
}

// host setup: N = 256, in[i] = i, two blocks of 128 -> 2 partial sums
const int N = 256;
int hin[N], hpartials[2];
for (int i = 0; i < N; i++) hin[i] = i;
int *din, *dpartials;
cudaMalloc(&din, N * sizeof(int));
cudaMalloc(&dpartials, 2 * sizeof(int));
cudaMemcpy(din, hin, N * sizeof(int), cudaMemcpyHostToDevice);

blockSum<<<2, 128>>>(din, dpartials);

cudaMemcpy(hpartials, dpartials, 2 * sizeof(int), cudaMemcpyDeviceToHost);
int total = hpartials[0] + hpartials[1];   // final combine on the CPU
cudaFree(din); cudaFree(dpartials);
```

Output (verified):

```
partial[0] = 8128     // sum 0..127
partial[1] = 24512    // sum 128..255
total      = 32640    // = 255*256/2  ✓
```

Pattern to remember: **grid produces per-block partial results → tiny final
combine on host**. Reductions, histograms, max/min all follow this shape.

---

## 12. Unified Memory — `cudaMallocManaged`

One allocation visible from both CPU and GPU; the driver migrates pages
automatically. Removes all the `cudaMemcpy` boilerplate — great for learning
and prototyping (explicit copies still win for peak performance).

```cpp
// vec_add_managed.cu
#include <cstdio>

__global__ void vecAdd(const float* a, const float* b, float* c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) c[i] = a[i] + b[i];
}

int main() {
    const int N = 8;
    float *a, *b, *c;
    cudaMallocManaged(&a, N * sizeof(float));    // ONE pointer, usable everywhere
    cudaMallocManaged(&b, N * sizeof(float));
    cudaMallocManaged(&c, N * sizeof(float));

    for (int i = 0; i < N; i++) { a[i] = i; b[i] = 10.0f * i; }  // CPU writes directly

    vecAdd<<<2, 4>>>(a, b, c, N);
    cudaDeviceSynchronize();      // REQUIRED before CPU reads c — no memcpy to wait on!

    for (int i = 0; i < N; i++) printf("c[%d] = %g\n", i, c[i]);
    // c[0]=0  c[1]=11  c[2]=22 ... c[7]=77   (same as section 5, verified)

    cudaFree(a); cudaFree(b); cudaFree(c);
    return 0;
}
```

The #1 unified-memory bug: forgetting `cudaDeviceSynchronize()` and reading
results before the (async) kernel finished.

---

## 13. 2D Grids — `dim3` and Matrix Add

Blocks and grids can be up to 3-dimensional — natural for images and matrices.
`dim3` bundles the dimensions:

```cpp
__global__ void matAdd(const float* A, const float* B, float* C,
                       int rows, int cols) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;   // x → columns
    int row = blockIdx.y * blockDim.y + threadIdx.y;   // y → rows
    if (row < rows && col < cols) {
        int i = row * cols + col;          // 2D coords → flat row-major index
        C[i] = A[i] + B[i];
    }
}

int rows = 2, cols = 3;
const int n = rows * cols;                             // 6 elements
const size_t bytes = n * sizeof(float);

// host setup: A = {0,1,2,3,4,5} (row-major 2x3), B all 100s
float hA[n] = {0, 1, 2, 3, 4, 5}, hB[n], hC[n];
for (int i = 0; i < n; i++) hB[i] = 100.0f;
float *dA, *dB, *dC;
cudaMalloc(&dA, bytes); cudaMalloc(&dB, bytes); cudaMalloc(&dC, bytes);
cudaMemcpy(dA, hA, bytes, cudaMemcpyHostToDevice);
cudaMemcpy(dB, hB, bytes, cudaMemcpyHostToDevice);

dim3 block(16, 16);                                    // 256 threads per block
dim3 grid((cols + block.x - 1) / block.x,              // ceiling division per axis
          (rows + block.y - 1) / block.y);             // = grid(1, 1) here
matAdd<<<grid, block>>>(dA, dB, dC, rows, cols);

cudaMemcpy(hC, dC, bytes, cudaMemcpyDeviceToHost);     // hC holds the result matrix
cudaFree(dA); cudaFree(dB); cudaFree(dC);
```

With `A = {0,1,2,3,4,5}` (row-major 2×3) and `B` all 100s, output (verified):

```
C = 100 101 102
    103 104 105
```

Same idioms as 1D, applied per-axis: ceiling division for the grid size,
bounds check both `row` and `col` (a 16×16 block launched for a 2×3 matrix
has 250 threads that must do nothing).
