import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { action, username, password } = body;

        console.log(`[Auth API] RECV: action=${action}, user=${username}`);

        if (action === 'signup') {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
            }
            const user = await User.create({ username, password });
            const token = signToken({ id: user._id, username: user.username });
            return NextResponse.json({ message: 'User created successfully', token });
        } else {
            const user = await User.findOne({ username });
            if (!user) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const token = signToken({ id: user._id, username: user.username });
            console.log(`[Auth API] SUCCESS: Authenticated ${username}`);

            return NextResponse.json({ message: 'Login successful', token });
        }
    } catch (error: any) {
        console.error(`[Auth API Error]`, error);
        return NextResponse.json({ error: 'Authentication service unavailable. Is MongoDB running?' }, { status: 500 });
    }
}
