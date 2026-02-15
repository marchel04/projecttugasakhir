import { NextResponse } from "next/server";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const bulan = searchParams.get("bulan");

    if (!bulan) {
        return NextResponse.json(
            { success: false, message: "Parameter bulan wajib" },
            { status: 400 }
        );
    }

    try {
        const backendRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/rekap/data-bulanan?bulan=${bulan}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: req.headers.get("cookie") || "",
                },
                credentials: "include",
            }
        );

        const data = await backendRes.json();
        return NextResponse.json(data, { status: backendRes.status });
    } catch {
        return NextResponse.json(
            { success: false, message: "Terjadi kesalahan server" },
            { status: 500 }
        );
    }
}
