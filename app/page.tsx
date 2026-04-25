'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            Cool-Chain Copilot
          </Badge>
          <div className="flex flex-col gap-2">
            <CardTitle>Cool-Chain Copilot</CardTitle>
            <CardDescription>
              Hackathon scaffold — design tokens verification
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <Input defaultValue="AKE12345CX" aria-label="Sample ULD input" />
        </CardContent>
      </Card>
    </main>
  );
}
