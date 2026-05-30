import { redirect } from 'next/navigation';

export default function NewNewsletterPage() {
  redirect('/admin/newsletters/new/configure');
}
